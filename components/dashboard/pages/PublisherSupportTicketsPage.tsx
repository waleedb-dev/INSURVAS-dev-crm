"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Filter, LifeBuoy, Search } from "lucide-react";
import { T } from "@/lib/theme";
import { Card } from "@/components/ui/card";
import { FilterChip, Input } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { FieldLabel } from "./daily-deal-flow/ui-primitives";
import { Table as ShadcnTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/shadcn/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TicketStatus = "open" | "in_progress" | "solved";
type TicketRow = {
  id: string;
  lead_id: string;
  assignee_id: string | null;
  title: string;
  description: string | null;
  status: TicketStatus;
  created_at: string;
  publisher?: { full_name: string | null } | { full_name: string | null }[] | null;
  assignee?: { full_name: string | null } | { full_name: string | null }[] | null;
  lead?: { phone: string | null; first_name: string | null; last_name: string | null; lead_unique_id: string | null } | null;
};

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  users?: { full_name: string | null } | { full_name: string | null }[] | null;
};

type FollowerRow = {
  user_id: string;
  users?: { full_name: string | null } | { full_name: string | null }[] | null;
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

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
}

function leadLabelFromTicket(ticket: TicketRow) {
  const lead = ticket.lead && !Array.isArray(ticket.lead) ? ticket.lead : Array.isArray(ticket.lead) ? ticket.lead[0] : null;
  return (
    lead?.lead_unique_id?.trim() ||
    [lead?.first_name, lead?.last_name].filter(Boolean).join(" ").trim() ||
    "Lead"
  );
}

function ticketDayKey(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function StyledSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={(val) => onValueChange(val || "")}>
      <SelectTrigger
        style={{
          width: "100%",
          height: 38,
          borderRadius: 10,
          border: `1px solid ${T.border}`,
          backgroundColor: T.cardBg,
          color: value && value !== "All" ? T.textDark : T.textMuted,
          fontSize: 13,
          fontWeight: 500,
          paddingLeft: 14,
          paddingRight: 12,
          transition: "all 0.15s ease-in-out",
          position: "relative",
          zIndex: 1,
        }}
        className="hover:border-[#233217] focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
      >
        <SelectValue placeholder={placeholder}>
          {value && value !== "All" ? options.find((option) => option.value === value)?.label || value : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        style={{
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          backgroundColor: T.cardBg,
          padding: 6,
          maxHeight: 300,
          zIndex: 50,
        }}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            style={{
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 400,
              color: T.textDark,
              cursor: "pointer",
              transition: "all 0.1s ease-in-out",
            }}
            className="hover:bg-[#DCEBDC] hover:text-[#233217] focus:bg-[#DCEBDC] focus:text-[#233217] data-[state=checked]:bg-[#233217] data-[state=checked]:text-white data-[state=checked]:font-semibold"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StatSkeleton() {
  return (
    <Card
      style={{
        borderRadius: 16,
        border: `1px solid ${T.border}`,
        borderBottom: "4px solid #DCEBDC",
        background: T.cardBg,
        boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
        padding: "20px 24px",
        minHeight: 100,
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, flex: 1 }}>
        <div style={{ width: 80, height: 10, borderRadius: 4, background: "linear-gradient(90deg, #E8E8E8 25%, #F0F0F0 50%, #E8E8E8 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
        <div style={{ width: 60, height: 26, borderRadius: 6, background: "linear-gradient(90deg, #E8E8E8 25%, #F0F0F0 50%, #E8E8E8 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
      </div>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "linear-gradient(90deg, #E8E8E8 25%, #F0F0F0 50%, #E8E8E8 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
        }}
      />
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </Card>
  );
}

function mapSelectOptions(values: string[], allLabel: string) {
  return [{ value: "All", label: allLabel }, ...values.map((value) => ({ value, label: value }))];
}

export default function PublisherSupportTicketsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const params = useParams<{ role?: string }>();
  const routeRole = Array.isArray(params?.role) ? params.role[0] : params?.role || "publisher_manager";

  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commentsByTicket, setCommentsByTicket] = useState<Record<string, CommentRow[]>>({});
  const [followersByTicket, setFollowersByTicket] = useState<Record<string, FollowerRow[]>>({});
  const [threadLoading, setThreadLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [followerUserId, setFollowerUserId] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentBody, setEditCommentBody] = useState("");
  const [search, setSearch] = useState("");
  const [filterDateSingle, setFilterDateSingle] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterPublisher, setFilterPublisher] = useState("All");
  const [filterAssigned, setFilterAssigned] = useState("All");
  const [filterPanelExpanded, setFilterPanelExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const [hoveredStatIdx, setHoveredStatIdx] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;
      if (cancelled) return;
      setSessionUserId(uid);
      if (!uid) {
        setIsSystemAdmin(false);
        return;
      }
      const { data } = await supabase.from("users").select("roles(key)").eq("id", uid).maybeSingle();
      if (cancelled) return;
      const rel = data?.roles as { key?: string } | { key?: string }[] | null | undefined;
      const key = Array.isArray(rel) ? rel[0]?.key : rel?.key;
      setIsSystemAdmin(key === "system_admin");
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTickets();
  }, [loadTickets]);

  const loadThread = useCallback(
    async (ticketId: string) => {
      setThreadLoading(true);
      const [cRes, fRes] = await Promise.all([
        supabase
          .from("ticket_comments")
          .select("id, body, created_at, user_id, users(full_name)")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: true }),
        supabase.from("ticket_followers").select("user_id, users(full_name)").eq("ticket_id", ticketId),
      ]);
      if (!cRes.error) {
        setCommentsByTicket((prev) => ({ ...prev, [ticketId]: (cRes.data ?? []) as unknown as CommentRow[] }));
      }
      if (!fRes.error) {
        setFollowersByTicket((prev) => ({ ...prev, [ticketId]: (fRes.data ?? []) as unknown as FollowerRow[] }));
      }
      setThreadLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (expandedId) void loadThread(expandedId);
  }, [expandedId, loadThread]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCommentDraft("");
    setFollowerUserId("");
    setEditingCommentId(null);
    setEditCommentBody("");
  }, [expandedId]);

  const updateStatus = async (ticketId: string, status: TicketStatus) => {
    setActionBusy(ticketId);
    setError(null);
    const { error: uErr } = await supabase.from("tickets").update({ status }).eq("id", ticketId);
    setActionBusy(null);
    if (uErr) setError(uErr.message);
    else await loadTickets();
  };

  const postComment = async (ticketId: string) => {
    if (!sessionUserId || !commentDraft.trim()) return;
    setActionBusy(`c-${ticketId}`);
    setError(null);
    const { error: pErr } = await supabase.from("ticket_comments").insert({
      ticket_id: ticketId,
      user_id: sessionUserId,
      body: commentDraft.trim(),
    });
    setActionBusy(null);
    if (pErr) {
      setError(pErr.message);
      return;
    }
    setCommentDraft("");
    await loadThread(ticketId);
  };

  const saveEditedComment = async (ticketId: string, commentId: string) => {
    const body = editCommentBody.trim();
    if (!body) return;
    setActionBusy(`e-${commentId}`);
    setError(null);
    const { error: uErr } = await supabase.from("ticket_comments").update({ body }).eq("id", commentId);
    setActionBusy(null);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    setEditingCommentId(null);
    await loadThread(ticketId);
  };

  const deleteComment = async (ticketId: string, commentId: string) => {
    setActionBusy(`d-${commentId}`);
    setError(null);
    const { error: dErr } = await supabase.from("ticket_comments").delete().eq("id", commentId);
    setActionBusy(null);
    if (dErr) {
      setError(dErr.message);
      return;
    }
    await loadThread(ticketId);
  };

  const addFollower = async (ticketId: string) => {
    const uid = followerUserId.trim();
    if (!isUuid(uid)) {
      setError("Follower must be a valid user UUID.");
      return;
    }
    setActionBusy(`f-${ticketId}`);
    setError(null);
    const { error: fErr } = await supabase.from("ticket_followers").insert({ ticket_id: ticketId, user_id: uid });
    setActionBusy(null);
    if (fErr) {
      setError(fErr.message);
      return;
    }
    setFollowerUserId("");
    await loadThread(ticketId);
  };

  const removeFollower = async (ticketId: string, userId: string) => {
    setActionBusy(`rf-${ticketId}`);
    setError(null);
    const { error: dErr } = await supabase.from("ticket_followers").delete().eq("ticket_id", ticketId).eq("user_id", userId);
    setActionBusy(null);
    if (dErr) {
      setError(dErr.message);
      return;
    }
    await loadThread(ticketId);
  };

  const publisherOptions = useMemo(
    () => Array.from(new Set(tickets.map((ticket) => joinName(ticket.publisher)).filter(Boolean) as string[])),
    [tickets],
  );

  const assignedOptions = useMemo(
    () => [
      { value: "All", label: "All tickets" },
      { value: "assigned", label: "Assigned only" },
      { value: "unassigned", label: "Unassigned only" },
    ],
    [],
  );

  const filteredTickets = useMemo(() => {
    const query = search.toLowerCase().trim();
    return tickets.filter((ticket) => {
      const leadLabel = leadLabelFromTicket(ticket);
      const publisherName = joinName(ticket.publisher) || "";
      const day = ticketDayKey(ticket.created_at);

      const matchesSearch =
        !query ||
        ticket.title.toLowerCase().includes(query) ||
        ticket.id.toLowerCase().includes(query) ||
        leadLabel.toLowerCase().includes(query) ||
        publisherName.toLowerCase().includes(query);

      let matchesDate = true;
      if (filterDateSingle) {
        matchesDate = day === filterDateSingle;
      } else {
        if (filterDateFrom && day && day < filterDateFrom) matchesDate = false;
        if (filterDateTo && day && day > filterDateTo) matchesDate = false;
      }

      const matchesStatus = filterStatus === "All" || ticket.status === filterStatus;
      const matchesPublisher = filterPublisher === "All" || publisherName === filterPublisher;
      const matchesAssigned =
        filterAssigned === "All" ||
        (filterAssigned === "assigned" ? Boolean(ticket.assignee_id) : !ticket.assignee_id);

      return matchesSearch && matchesDate && matchesStatus && matchesPublisher && matchesAssigned;
    });
  }, [tickets, search, filterDateSingle, filterDateFrom, filterDateTo, filterStatus, filterPublisher, filterAssigned]);

  const totalOpen = useMemo(() => filteredTickets.filter((ticket) => ticket.status === "open").length, [filteredTickets]);
  const totalInProgress = useMemo(() => filteredTickets.filter((ticket) => ticket.status === "in_progress").length, [filteredTickets]);
  const totalSolved = useMemo(() => filteredTickets.filter((ticket) => ticket.status === "solved").length, [filteredTickets]);
  const totalAssigned = useMemo(() => filteredTickets.filter((ticket) => Boolean(ticket.assignee_id)).length, [filteredTickets]);
  const hasActiveFilters = useMemo(
    () =>
      filterDateSingle !== "" ||
      filterDateFrom !== "" ||
      filterDateTo !== "" ||
      filterStatus !== "All" ||
      filterPublisher !== "All" ||
      filterAssigned !== "All",
    [filterDateSingle, filterDateFrom, filterDateTo, filterStatus, filterPublisher, filterAssigned],
  );

  const detailedFilterCount = useMemo(() => {
    let count = 0;
    if (filterDateSingle) count++;
    if (filterDateFrom) count++;
    if (filterDateTo) count++;
    if (filterStatus !== "All") count++;
    if (filterPublisher !== "All") count++;
    if (filterAssigned !== "All") count++;
    return count;
  }, [filterDateSingle, filterDateFrom, filterDateTo, filterStatus, filterPublisher, filterAssigned]);

  const clearFilters = () => {
    setSearch("");
    setFilterDateSingle("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterStatus("All");
    setFilterPublisher("All");
    setFilterAssigned("All");
    setPage(1);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [search, filterDateSingle, filterDateFrom, filterDateTo, filterStatus, filterPublisher, filterAssigned]);

  const itemsPerPage = 7;
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / itemsPerPage));
  const paginatedTickets = useMemo(
    () => filteredTickets.slice((page - 1) * itemsPerPage, page * itemsPerPage),
    [filteredTickets, page],
  );

  const accent = "#233217";

  return (
    <div
      style={{
        fontFamily: T.font,
        color: T.textDark,
      }}
    >
      {error && (
        <div
          style={{
            marginBottom: 20,
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 20,
          marginBottom: 24,
        }}
      >
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          [
            { label: "TOTAL TICKETS", value: filteredTickets.length.toString(), color: "#233217", icon: <LifeBuoy size={18} strokeWidth={2} /> },
            { label: "OPEN TICKETS", value: totalOpen.toString(), color: "#233217", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg> },
            { label: "IN PROGRESS", value: totalInProgress.toString(), color: "#233217", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg> },
            { label: "SOLVED TICKETS", value: totalSolved.toString(), color: "#233217", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> },
            { label: "ASSIGNED TICKETS", value: `${totalAssigned}/${Math.max(filteredTickets.length, 0)}`, color: "#233217", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg> },
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

      <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 14 }}>
        <div
          style={{
            width: "100%",
            background: T.cardBg,
            border: `1px solid ${T.border}`,
            borderBottom: filterPanelExpanded || hasActiveFilters ? "none" : `1px solid ${T.border}`,
            borderRadius: filterPanelExpanded || hasActiveFilters ? "16px 16px 0 0" : 16,
            padding: "14px 20px",
            boxShadow: filterPanelExpanded || hasActiveFilters ? "none" : T.shadowSm,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={16} style={{ position: "absolute", left: 12, pointerEvents: "none", zIndex: 1, color: T.textMuted }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tickets..."
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
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => setFilterPanelExpanded((value) => !value)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 38,
                padding: "0 16px",
                borderRadius: 10,
                border: filterPanelExpanded ? "1.5px solid #233217" : `1px solid ${T.border}`,
                background: filterPanelExpanded ? "#DCEBDC" : T.pageBg,
                color: filterPanelExpanded ? "#233217" : T.textDark,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: T.font,
                cursor: "pointer",
                transition: "all 0.15s ease-in-out",
              }}
            >
              <Filter size={16} />
              Filters
              {detailedFilterCount > 0 && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 20,
                    height: 20,
                    padding: "0 6px",
                    borderRadius: 999,
                    background: "#233217",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {detailedFilterCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => void loadTickets()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 38,
                padding: "0 18px",
                borderRadius: 10,
                border: "none",
                background: "#233217",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: T.font,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(35, 50, 23, 0.2)",
                transition: "all 0.15s ease-in-out",
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        {(filterPanelExpanded || hasActiveFilters) && (
          <div
            style={{
              width: "100%",
              background: T.cardBg,
              border: `1px solid ${T.border}`,
              borderRadius: "0 0 16px 16px",
              padding: "20px 24px",
              boxShadow: T.shadowSm,
              display: "flex",
              flexDirection: "column",
              gap: 20,
              overflow: "visible",
              position: "relative",
              zIndex: 50,
            }}
          >
            {filterPanelExpanded && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, alignItems: "end" }}>
                  <div>
                    <FieldLabel label="Single date" />
                    <input
                      type="date"
                      value={filterDateSingle}
                      onChange={(e) => {
                        setFilterDateSingle(e.target.value);
                        setFilterDateFrom("");
                        setFilterDateTo("");
                      }}
                      style={{
                        width: "100%",
                        height: 38,
                        borderRadius: 10,
                        border: `1px solid ${T.border}`,
                        backgroundColor: T.cardBg,
                        color: filterDateSingle ? T.textDark : T.textMuted,
                        fontSize: 13,
                        fontWeight: 500,
                        padding: "0 12px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <FieldLabel label="Date from" />
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => {
                        setFilterDateFrom(e.target.value);
                        setFilterDateSingle("");
                      }}
                      style={{
                        width: "100%",
                        height: 38,
                        borderRadius: 10,
                        border: `1px solid ${T.border}`,
                        backgroundColor: T.cardBg,
                        color: filterDateFrom ? T.textDark : T.textMuted,
                        fontSize: 13,
                        fontWeight: 500,
                        padding: "0 12px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <FieldLabel label="Date to" />
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => {
                        setFilterDateTo(e.target.value);
                        setFilterDateSingle("");
                      }}
                      style={{
                        width: "100%",
                        height: 38,
                        borderRadius: 10,
                        border: `1px solid ${T.border}`,
                        backgroundColor: T.cardBg,
                        color: filterDateTo ? T.textDark : T.textMuted,
                        fontSize: 13,
                        fontWeight: 500,
                        padding: "0 12px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, alignItems: "end" }}>
                  <div>
                    <FieldLabel label="Status" />
                    <StyledSelect
                      value={filterStatus}
                      onValueChange={setFilterStatus}
                      options={[
                        { value: "All", label: "All statuses" },
                        { value: "open", label: "Open" },
                        { value: "in_progress", label: "In progress" },
                        { value: "solved", label: "Solved" },
                      ]}
                      placeholder="All statuses"
                    />
                  </div>
                  <div>
                    <FieldLabel label="Publisher" />
                    <StyledSelect
                      value={filterPublisher}
                      onValueChange={setFilterPublisher}
                      options={mapSelectOptions(publisherOptions, "All publishers")}
                      placeholder="All publishers"
                    />
                  </div>
                  <div>
                    <FieldLabel label="Assignment" />
                    <StyledSelect
                      value={filterAssigned}
                      onValueChange={setFilterAssigned}
                      options={assignedOptions}
                      placeholder="All tickets"
                    />
                  </div>
                </div>
              </div>
            )}

            {hasActiveFilters && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  paddingTop: filterPanelExpanded ? 16 : 0,
                  borderTop: filterPanelExpanded ? `1px solid ${T.border}` : "none",
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Active:
                  </span>
                  {filterDateSingle !== "" && <FilterChip label={`Date: ${filterDateSingle}`} onClear={() => setFilterDateSingle("")} />}
                  {filterDateFrom !== "" && <FilterChip label={`From: ${filterDateFrom}`} onClear={() => setFilterDateFrom("")} />}
                  {filterDateTo !== "" && <FilterChip label={`To: ${filterDateTo}`} onClear={() => setFilterDateTo("")} />}
                  {filterStatus !== "All" && <FilterChip label={`Status: ${formatStatus(filterStatus as TicketStatus)}`} onClear={() => setFilterStatus("All")} />}
                  {filterPublisher !== "All" && <FilterChip label={`Publisher: ${filterPublisher}`} onClear={() => setFilterPublisher("All")} />}
                  {filterAssigned !== "All" && <FilterChip label={filterAssigned === "assigned" ? "Assigned only" : "Unassigned only"} onClear={() => setFilterAssigned("All")} />}
                </div>

                <button
                  type="button"
                  onClick={clearFilters}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#233217",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: "4px 0",
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
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
                paginatedTickets.map((ticket) => {
                  const isOpen = expandedId === ticket.id;
                  return (
                    <TableRow
                      key={ticket.id}
                      style={{ cursor: "pointer", borderBottom: `1px solid ${T.border}` }}
                      className="hover:bg-muted/30 transition-all duration-150"
                      onClick={() => setExpandedId(isOpen ? null : ticket.id)}
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
                            setExpandedId(isOpen ? null : ticket.id);
                          }}
                          style={{
                            border: `1px solid ${T.border}`,
                            borderRadius: 10,
                            background: T.cardBg,
                            color: "#233217",
                            fontSize: 12,
                            fontWeight: 600,
                            padding: "6px 14px",
                            cursor: "pointer",
                          }}
                        >
                          {isOpen ? "Hide" : "View"}
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })
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
                }}
              >
                Previous
              </button>
              <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 500, padding: "0 8px" }}>
                Page {Math.min(page, totalPages)} of {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages || filteredTickets.length === 0}
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
                }}
              >
                Next
              </button>
            </div>
          </div>
      </div>

      {!loading && expandedId && (
        <div
          style={{
            marginTop: 28,
            padding: 24,
            borderRadius: 16,
            border: `1px solid ${T.border}`,
            background: T.cardBg,
            boxShadow: T.shadowSm,
          }}
          onClick={(e) => e.stopPropagation()}
          role="presentation"
        >
          {(() => {
            const ticket = tickets.find((row) => row.id === expandedId);
            if (!ticket) return null;
            const comments = commentsByTicket[ticket.id] ?? [];
            const followers = followersByTicket[ticket.id] ?? [];
            const isAssignee = sessionUserId != null && ticket.assignee_id === sessionUserId;
            const canManageTicketFields = isAssignee || isSystemAdmin;

            return (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 24 }}>
                <div>
                  <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>Ticket detail</h3>
                  <p style={{ margin: "0 0 8px", fontSize: 14, color: T.textMid }}>
                    <strong>Lead:</strong>{" "}
                    <Link href={`/dashboard/${routeRole}/leads/${ticket.lead_id}`} style={{ color: T.blue, fontWeight: 700 }}>
                      Open lead
                    </Link>
                  </p>
                  <p style={{ margin: "0 0 8px", fontSize: 14, color: T.textMid }}>
                    <strong>Assignee:</strong>{" "}
                    <span style={{ color: T.textDark, fontWeight: 600 }}>
                      {joinName(ticket.assignee) || (ticket.assignee_id ? ticket.assignee_id.slice(0, 8) : "Unassigned")}
                    </span>
                  </p>
                  {ticket.description && (
                    <p style={{ margin: "12px 0 0", fontSize: 14, color: T.textDark, lineHeight: 1.55 }}>{ticket.description}</p>
                  )}
                  {canManageTicketFields && (
                    <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                      <label style={{ fontSize: 13, fontWeight: 700, color: T.textMid }}>Status</label>
                      <select
                        value={ticket.status}
                        disabled={actionBusy === ticket.id}
                        onChange={(e) => void updateStatus(ticket.id, e.target.value as TicketStatus)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: T.radiusSm,
                          border: `1px solid ${T.border}`,
                          fontSize: 13,
                          fontFamily: T.font,
                          fontWeight: 600,
                        }}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In progress</option>
                        <option value="solved">Solved</option>
                      </select>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 800 }}>Comments</h3>
                    {threadLoading && <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>Loading thread…</p>}
                    {!threadLoading && comments.length === 0 && <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>No comments yet.</p>}
                    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                      {comments.map((comment) => {
                        const name = joinName(comment.users) || comment.user_id.slice(0, 8);
                        const own = sessionUserId === comment.user_id;
                        const editing = editingCommentId === comment.id;
                        return (
                          <li
                            key={comment.id}
                            style={{
                              padding: "12px 14px",
                              borderRadius: T.radiusMd,
                              border: `1px solid ${T.border}`,
                              background: T.pageBg,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>{name}</span>
                              <span style={{ fontSize: 11, color: T.textMuted }}>{new Date(comment.created_at).toLocaleString()}</span>
                            </div>
                            {editing ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                <textarea
                                  value={editCommentBody}
                                  onChange={(e) => setEditCommentBody(e.target.value)}
                                  rows={3}
                                  style={{
                                    width: "100%",
                                    boxSizing: "border-box",
                                    padding: 10,
                                    borderRadius: T.radiusSm,
                                    border: `1px solid ${T.border}`,
                                    fontSize: 13,
                                    fontFamily: T.font,
                                  }}
                                />
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button
                                    type="button"
                                    disabled={actionBusy === `e-${comment.id}`}
                                    onClick={() => void saveEditedComment(ticket.id, comment.id)}
                                    style={{
                                      padding: "6px 12px",
                                      borderRadius: 8,
                                      border: "none",
                                      background: accent,
                                      color: "#fff",
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCommentId(null);
                                      setEditCommentBody("");
                                    }}
                                    style={{
                                      padding: "6px 12px",
                                      borderRadius: 8,
                                      border: `1px solid ${T.border}`,
                                      background: T.cardBg,
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p style={{ margin: 0, fontSize: 14, color: T.textDark, lineHeight: 1.5 }}>{comment.body}</p>
                                {own && (
                                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCommentId(comment.id);
                                        setEditCommentBody(comment.body);
                                      }}
                                      style={{
                                        padding: "4px 10px",
                                        fontSize: 12,
                                        fontWeight: 700,
                                        borderRadius: 6,
                                        border: `1px solid ${T.border}`,
                                        background: T.cardBg,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void deleteComment(ticket.id, comment.id)}
                                      disabled={actionBusy === `d-${comment.id}`}
                                      style={{
                                        padding: "4px 10px",
                                        fontSize: 12,
                                        fontWeight: 700,
                                        borderRadius: 6,
                                        border: "1px solid #fecaca",
                                        background: "#fef2f2",
                                        color: "#991b1b",
                                        cursor: "pointer",
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    {sessionUserId && (
                      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                        <textarea
                          value={commentDraft}
                          onChange={(e) => setCommentDraft(e.target.value)}
                          placeholder="Add a comment…"
                          rows={3}
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            padding: 10,
                            borderRadius: T.radiusSm,
                            border: `1px solid ${T.border}`,
                            fontSize: 13,
                            fontFamily: T.font,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => void postComment(ticket.id)}
                          disabled={!commentDraft.trim() || actionBusy === `c-${ticket.id}`}
                          style={{
                            alignSelf: "flex-start",
                            padding: "8px 16px",
                            borderRadius: T.radiusMd,
                            border: "none",
                            background: accent,
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: commentDraft.trim() ? "pointer" : "not-allowed",
                            opacity: commentDraft.trim() ? 1 : 0.5,
                          }}
                        >
                          Post comment
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 800 }}>Followers</h3>
                    <p style={{ margin: "0 0 10px", fontSize: 12, color: T.textMuted, lineHeight: 1.45 }}>
                      Only the assignee can add or remove followers. Paste a user UUID.
                    </p>
                    <ul style={{ listStyle: "none", margin: "0 0 12px", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                      {followers.map((follower) => (
                        <li
                          key={follower.user_id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: 13,
                            padding: "8px 10px",
                            borderRadius: T.radiusSm,
                            border: `1px solid ${T.border}`,
                            background: T.pageBg,
                          }}
                        >
                          <span>{joinName(follower.users) || follower.user_id}</span>
                          {canManageTicketFields && (
                            <button
                              type="button"
                              onClick={() => void removeFollower(ticket.id, follower.user_id)}
                              disabled={actionBusy === `rf-${ticket.id}`}
                              style={{
                                padding: "4px 8px",
                                fontSize: 11,
                                fontWeight: 700,
                                borderRadius: 6,
                                border: "none",
                                background: "#fef2f2",
                                color: "#b91c1c",
                                cursor: "pointer",
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                    {canManageTicketFields && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        <Input
                          value={followerUserId}
                          onChange={(e) => setFollowerUserId(e.target.value)}
                          placeholder="User UUID"
                          style={{ flex: 1, minWidth: 200, height: 38 }}
                        />
                        <button
                          type="button"
                          onClick={() => void addFollower(ticket.id)}
                          disabled={actionBusy === `f-${ticket.id}`}
                          style={{
                            padding: "8px 14px",
                            borderRadius: T.radiusMd,
                            border: "none",
                            background: accent,
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Add follower
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
