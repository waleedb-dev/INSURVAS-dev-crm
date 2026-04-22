"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LifeBuoy, Search, Plus } from "lucide-react";
import { T } from "@/lib/theme";
import { EmptyState } from "@/components/ui";
import { Card } from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Table as ShadcnTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/shadcn/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CreateLeadTicketModal from "./CreateLeadTicketModal";

type TicketStatus = "open" | "in_progress" | "solved";

type TicketRow = {
  id: string;
  lead_id: string | null;
  lead_name: string | null;
  assignee_id: string | null;
  title: string;
  description: string | null;
  status: TicketStatus;
  created_at: string;
  publisher?: { full_name: string | null } | { full_name: string | null }[] | null;
  assignee?: { full_name: string | null } | { full_name: string | null }[] | null;
  lead?: { phone: string | null; first_name: string | null; last_name: string | null; lead_unique_id: string | null } | null;
};

function formatStatus(s: TicketStatus): string {
  if (s === "in_progress") return "In progress";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function joinName(rel: unknown): string | null {
  if (rel == null) return null;
  const row = Array.isArray(rel) ? rel[0] : rel;
  if (row && typeof row === "object" && "full_name" in row) {
    const v = (row as { full_name: string | null }).full_name;
    return v ?? null;
  }
  return null;
}

function leadLabelFromTicket(ticket: TicketRow) {
  const lead = ticket.lead && !Array.isArray(ticket.lead) ? ticket.lead : Array.isArray(ticket.lead) ? ticket.lead[0] : null;
  return (
    lead?.lead_unique_id?.trim() ||
    [lead?.first_name, lead?.last_name].filter(Boolean).join(" ").trim() ||
    lead?.phone?.trim() ||
    ticket.lead_name?.trim() ||
    "Lead"
  );
}

export default function CallCenterSupportTicketsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const params = useParams<{ role?: string }>();
  const routeRole = Array.isArray(params?.role) ? params.role[0] : params?.role || "agent";

  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"All" | TicketStatus>("All");
  const [page, setPage] = useState(1);
  const [hoveredStatIdx, setHoveredStatIdx] = useState<number | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      setSessionUserId(session?.user?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from("tickets")
      .select(
        `
        id,
        lead_id,
        lead_name,
        assignee_id,
        title,
        description,
        status,
        created_at,
        publisher:users!tickets_publisher_id_fkey(full_name),
        assignee:users!tickets_assignee_id_fkey(full_name),
        lead:leads(phone, first_name, last_name, lead_unique_id)
      `,
      )
      .order("created_at", { ascending: false });

    if (qErr) {
      setError(qErr.message);
      setTickets([]);
    } else {
      setTickets((data ?? []) as unknown as TicketRow[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const filteredTickets = useMemo(() => {
    const q = search.toLowerCase().trim();
    return tickets.filter((ticket) => {
      const matchesSearch =
        !q ||
        ticket.title.toLowerCase().includes(q) ||
        ticket.id.toLowerCase().includes(q) ||
        leadLabelFromTicket(ticket).toLowerCase().includes(q);
      const matchesStatus = filterStatus === "All" || ticket.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [tickets, search, filterStatus]);

  const totalOpen = useMemo(() => filteredTickets.filter((t) => t.status === "open").length, [filteredTickets]);
  const totalInProgress = useMemo(() => filteredTickets.filter((t) => t.status === "in_progress").length, [filteredTickets]);
  const totalSolved = useMemo(() => filteredTickets.filter((t) => t.status === "solved").length, [filteredTickets]);

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / itemsPerPage));
  const paginatedTickets = useMemo(
    () => filteredTickets.slice((page - 1) * itemsPerPage, page * itemsPerPage),
    [filteredTickets, page],
  );

  const accent = "#233217";

  return (
    <div style={{ fontFamily: T.font, color: T.textDark }}>
      {error && (
        <div
          style={{
            marginBottom: 18,
            padding: "12px 14px",
            borderRadius: T.radiusMd,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20, marginBottom: 24 }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card
              key={i}
              style={{
                borderRadius: 16,
                border: `1px solid ${T.border}`,
                borderBottom: "4px solid #DCEBDC",
                background: T.cardBg,
                boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                padding: "20px 24px",
                minHeight: 100,
              }}
            />
          ))
        ) : (
          [
            { label: "TOTAL TICKETS", value: filteredTickets.length.toString(), color: "#233217", icon: <LifeBuoy size={18} strokeWidth={2} /> },
            { label: "OPEN TICKETS", value: totalOpen.toString(), color: "#233217", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg> },
            { label: "IN PROGRESS", value: totalInProgress.toString(), color: "#233217", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg> },
            { label: "SOLVED TICKETS", value: totalSolved.toString(), color: "#233217", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> },
          ].map(({ label, value, color, icon }, i) => (
            <Card
              key={label}
              onMouseEnter={() => setHoveredStatIdx(i)}
              onMouseLeave={() => setHoveredStatIdx(null)}
              style={{
                borderRadius: 16,
                border: `1px solid ${T.border}`,
                borderBottom: `4px solid ${color}`,
                background: `linear-gradient(135deg, color-mix(in srgb, ${color} 20%, ${T.cardBg}) 0%, ${T.cardBg} 80%)`,
                boxShadow:
                  hoveredStatIdx === i
                    ? "0 14px 40px rgba(28, 32, 26, 0.08), 0 4px 14px rgba(28, 32, 26, 0.05)"
                    : "0 4px 12px rgba(0,0,0,0.03)",
                transform: hoveredStatIdx === i ? "translateY(-3px)" : "translateY(0)",
                transition: "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
                padding: "20px 24px",
                minHeight: 100,
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                cursor: "default",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#233217", letterSpacing: "0.45px", textTransform: "uppercase", lineHeight: 1.25 }}>{label}</span>
                <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.05, wordBreak: "break-all" }}>{value}</div>
              </div>
              <div
                style={{
                  color,
                  backgroundColor:
                    hoveredStatIdx === i ? `color-mix(in srgb, ${color} 24%, transparent)` : `color-mix(in srgb, ${color} 15%, transparent)`,
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "background-color 0.32s cubic-bezier(0.22, 1, 0.36, 1), transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
                  transform: hoveredStatIdx === i ? "scale(1.04)" : "scale(1)",
                }}
              >
                {icon}
              </div>
            </Card>
          ))
        )}
      </div>

      <div
        style={{
          width: "100%",
          background: T.cardBg,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          padding: "14px 20px",
          boxShadow: T.shadowSm,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={16} style={{ position: "absolute", left: 12, pointerEvents: "none", zIndex: 1, color: T.textMuted }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tickets..."
              aria-label="Search tickets"
              style={{
                height: 38,
                minWidth: 260,
                paddingLeft: 38,
                paddingRight: 14,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                fontSize: 14,
                color: T.textDark,
                background: T.pageBg,
                outline: "none",
                fontFamily: T.font,
                transition: "all 0.15s ease-in-out",
              }}
              className="focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
            />
          </div>
          <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val as "All" | TicketStatus)}>
            <SelectTrigger
              aria-label="Filter by status"
              style={{
                height: 38,
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                backgroundColor: T.pageBg,
                color: T.textDark,
                fontSize: 13,
                fontWeight: 600,
                padding: "0 12px",
                fontFamily: T.font,
                outline: "none",
              }}
              className="hover:border-[#233217] focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
            >
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent
              style={{
                borderRadius: 12,
                border: `1px solid ${T.border}`,
                boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                backgroundColor: T.cardBg,
                padding: 6,
              }}
            >
              <SelectItem value="All" style={{ borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 400, color: T.textDark, cursor: "pointer" }} className="hover:bg-[#DCEBDC] hover:text-[#233217] focus:bg-[#DCEBDC] focus:text-[#233217] data-[state=checked]:bg-[#233217] data-[state=checked]:text-white data-[state=checked]:font-semibold">
                All statuses
              </SelectItem>
              <SelectItem value="open" style={{ borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 400, color: T.textDark, cursor: "pointer" }} className="hover:bg-[#DCEBDC] hover:text-[#233217] focus:bg-[#DCEBDC] focus:text-[#233217] data-[state=checked]:bg-[#233217] data-[state=checked]:text-white data-[state=checked]:font-semibold">
                Open
              </SelectItem>
              <SelectItem value="in_progress" style={{ borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 400, color: T.textDark, cursor: "pointer" }} className="hover:bg-[#DCEBDC] hover:text-[#233217] focus:bg-[#DCEBDC] focus:text-[#233217] data-[state=checked]:bg-[#233217] data-[state=checked]:text-white data-[state=checked]:font-semibold">
                In progress
              </SelectItem>
              <SelectItem value="solved" style={{ borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 400, color: T.textDark, cursor: "pointer" }} className="hover:bg-[#DCEBDC] hover:text-[#233217] focus:bg-[#DCEBDC] focus:text-[#233217] data-[state=checked]:bg-[#233217] data-[state=checked]:text-white data-[state=checked]:font-semibold">
                Solved
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 38,
              padding: "0 16px",
              borderRadius: 10,
              border: `1.5px solid ${accent}`,
              background: "#fff",
              color: accent,
              fontSize: 13,
              fontWeight: 700,
              fontFamily: T.font,
              cursor: "pointer",
              transition: "all 0.15s ease-in-out",
              outline: "none",
            }}
            className="hover:bg-[#f6f9f4] focus-visible:ring-2 focus-visible:ring-[#233217]/40"
          >
            <Plus size={16} />
            New ticket
          </button>
          <button
            type="button"
            onClick={() => void loadTickets()}
            disabled={loading}
            aria-label="Refresh tickets"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              height: 38,
              padding: "0 18px",
              borderRadius: 10,
              border: "none",
              background: accent,
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              fontFamily: T.font,
              cursor: loading ? "wait" : "pointer",
              boxShadow: "0 4px 12px rgba(35, 50, 23, 0.2)",
              transition: "all 0.15s ease-in-out",
              outline: "none",
            }}
            className="focus-visible:ring-2 focus-visible:ring-[#233217]/40 focus-visible:ring-offset-2"
          >
            Refresh
          </button>
        </div>
      </div>

      <div
        style={{
          borderRadius: 16,
          border: `1px solid ${T.border}`,
          overflow: "hidden",
          backgroundColor: T.cardBg,
        }}
      >
        <ShadcnTable>
          <TableHeader style={{ backgroundColor: "#233217" }}>
            <TableRow style={{ borderBottom: "none" }} className="hover:bg-transparent">
              {[
                { label: "Ticket ID", align: "left" as const },
                { label: "Title", align: "left" as const },
                { label: "Lead", align: "left" as const },
                { label: "Publisher", align: "left" as const },
                { label: "Status", align: "left" as const },
                { label: "Created", align: "left" as const },
                { label: "Actions", align: "center" as const },
              ].map(({ label, align }) => (
                <TableHead
                  key={label}
                  style={{
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: "0.3px",
                    padding: "16px 20px",
                    whiteSpace: "nowrap",
                    textAlign: align,
                  }}
                >
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: "60px 20px", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        border: `4px solid ${T.border}`,
                        borderTopColor: "#233217",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    <style>{`
                      @keyframes spin {
                        to { transform: rotate(360deg); }
                      }
                    `}</style>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#233217" }}>Loading tickets...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedTickets.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "60px 20px", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <Search size={40} color={T.textMuted} style={{ opacity: 0.5 }} />
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: T.textDark }}>No tickets found</h3>
                    <p style={{ margin: 0, fontSize: 14, color: T.textMuted }}>Try changing your search or filter selections.</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedTickets.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  style={{ cursor: "pointer", borderBottom: `1px solid ${T.border}` }}
                  className="hover:bg-muted/30 transition-all duration-150"
                  onClick={() => router.push(`/dashboard/${routeRole}/support-tickets/${ticket.id}`)}
                >
                  <TableCell style={{ padding: "14px 20px" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#233217" }}>{ticket.id.slice(0, 8)}</span>
                  </TableCell>
                  <TableCell style={{ padding: "14px 20px" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.textDark }}>{ticket.title}</span>
                  </TableCell>
                  <TableCell style={{ padding: "14px 20px" }}>
                    <span style={{ fontSize: 14, color: T.textDark }}>{leadLabelFromTicket(ticket)}</span>
                  </TableCell>
                  <TableCell style={{ padding: "14px 20px" }}>
                    <span style={{ fontSize: 14, color: T.textDark }}>{joinName(ticket.publisher) || "—"}</span>
                  </TableCell>
                  <TableCell style={{ padding: "14px 20px" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#233217" }}>{formatStatus(ticket.status)}</span>
                  </TableCell>
                  <TableCell style={{ padding: "14px 20px" }}>
                    <span style={{ fontSize: 14, color: T.textDark }}>{new Date(ticket.created_at).toLocaleDateString()}</span>
                  </TableCell>
                  <TableCell style={{ padding: "12px 16px", textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboard/${routeRole}/support-tickets/${ticket.id}`);
                      }}
                      aria-label={`View ticket ${ticket.id.slice(0, 8)}`}
                      style={{
                        border: `1px solid ${T.border}`,
                        borderRadius: 10,
                        background: T.cardBg,
                        color: "#233217",
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "6px 14px",
                        cursor: "pointer",
                        outline: "none",
                        transition: "all 0.15s ease-in-out",
                      }}
                      className="hover:border-[#233217] focus-visible:ring-2 focus-visible:ring-[#233217]/40"
                    >
                      View
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </ShadcnTable>

        <div
          style={{
            backgroundColor: T.cardBg,
            borderTop: `1px solid ${T.border}`,
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 13, color: "#233217", fontWeight: 500 }}>
            Showing {filteredTickets.length === 0 ? 0 : (page - 1) * itemsPerPage + 1} - {Math.min(page * itemsPerPage, filteredTickets.length)} of {filteredTickets.length} tickets
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              aria-label="Previous page"
              style={{
                backgroundColor: "transparent",
                color: page === 1 ? T.textMuted : "#233217",
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                cursor: page === 1 ? "not-allowed" : "pointer",
                fontFamily: T.font,
                opacity: page === 1 ? 0.5 : 1,
                outline: "none",
                transition: "all 0.15s ease-in-out",
              }}
              className="hover:border-[#233217] focus-visible:ring-2 focus-visible:ring-[#233217]/40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 500, padding: "0 8px" }}>
              Page {Math.min(page, totalPages)} of {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages || filteredTickets.length === 0}
              aria-label="Next page"
              style={{
                backgroundColor: "transparent",
                color: page === totalPages || filteredTickets.length === 0 ? T.textMuted : "#233217",
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                cursor: page === totalPages || filteredTickets.length === 0 ? "not-allowed" : "pointer",
                fontFamily: T.font,
                opacity: page === totalPages || filteredTickets.length === 0 ? 0.5 : 1,
                outline: "none",
                transition: "all 0.15s ease-in-out",
              }}
              className="hover:border-[#233217] focus-visible:ring-2 focus-visible:ring-[#233217]/40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <CreateLeadTicketModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        sessionUserId={sessionUserId}
        onCreated={() => {
          setCreateModalOpen(false);
          void loadTickets();
        }}
      />
    </div>
  );
}
