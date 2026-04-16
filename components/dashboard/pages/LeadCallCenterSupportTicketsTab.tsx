"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TicketIcon, RefreshCw, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { T } from "@/lib/theme";
import { EmptyState } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

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
};

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  users?: { full_name: string | null } | { full_name: string | null }[] | null;
};

function formatStatus(s: TicketStatus): { label: string; bg: string; color: string } {
  if (s === "open") return { label: "Open", bg: "#FEF3C7", color: "#92400E" };
  if (s === "in_progress") return { label: "In progress", bg: "#DBEAFE", color: "#1E40AF" };
  return { label: "Solved", bg: "#D1FAE5", color: "#065F46" };
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

type Props = {
  leadId: string | null;
  sessionUserId: string | null;
  /** Increment from parent after creating a ticket to refetch the list. */
  refreshKey?: number;
};

export default function LeadCallCenterSupportTicketsTab({ leadId, sessionUserId, refreshKey = 0 }: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commentsByTicket, setCommentsByTicket] = useState<Record<string, CommentRow[]>>({});
  const [threadLoading, setThreadLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    if (!leadId) {
      setTickets([]);
      setLoading(false);
      return;
    }
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
        assignee:users!tickets_assignee_id_fkey(full_name)
      `,
      )
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (qErr) {
      setError(qErr.message);
      setTickets([]);
    } else {
      setTickets((data ?? []) as unknown as TicketRow[]);
    }
    setLoading(false);
  }, [leadId, supabase]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets, refreshKey]);

  const loadThread = useCallback(
    async (ticketId: string) => {
      setThreadLoading(true);
      const { data, error: cErr } = await supabase
        .from("ticket_comments")
        .select("id, body, created_at, user_id, users(full_name)")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (!cErr) {
        setCommentsByTicket((prev) => ({ ...prev, [ticketId]: (data ?? []) as unknown as CommentRow[] }));
      }
      setThreadLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    if (expandedId) void loadThread(expandedId);
  }, [expandedId, loadThread]);

  useEffect(() => {
    setCommentDraft("");
  }, [expandedId]);

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

  if (!leadId) {
    return <EmptyState title="No lead" description="Save the lead before viewing support tickets." />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: T.font }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          padding: "16px 20px",
          background: "#f8faf8",
          borderRadius: 12,
          border: `1px solid ${T.border}`,
        }}
      >
        <div style={{ flex: 1, minWidth: 280 }}>
          <p style={{ margin: 0, fontSize: 13, color: T.textMuted, lineHeight: 1.6 }}>
            Tickets your call center raised for this lead (visible to all admins in your center). Use{" "}
            <strong style={{ color: T.textDark, fontWeight: 600 }}>New ticket</strong> above to publish another request to your Publisher Manager.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadTickets()}
          disabled={loading}
          aria-label="Refresh tickets"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 8,
            border: `1px solid ${T.border}`,
            background: T.cardBg,
            color: "#233217",
            fontSize: 13,
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            fontFamily: T.font,
            outline: "none",
            transition: "all 0.15s ease-in-out",
          }}
          className="hover:border-[#233217] focus-visible:ring-2 focus-visible:ring-[#233217]/40"
        >
          <RefreshCw size={14} style={{ opacity: loading ? 0.5 : 1 }} />
          Refresh
        </button>
      </div>

      {error && (
        <div
          style={{
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

      {loading ? (
        <div
          style={{
            padding: "48px 20px",
            textAlign: "center",
            borderRadius: 12,
            border: `1px dashed ${T.border}`,
            background: T.cardBg,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              border: `3px solid ${T.border}`,
              borderTopColor: "#233217",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 12px",
            }}
          />
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.textMuted }}>Loading tickets…</p>
        </div>
      ) : tickets.length === 0 ? (
        <div
          style={{
            padding: "48px 20px",
            textAlign: "center",
            borderRadius: 12,
            border: `1px dashed ${T.border}`,
            background: T.cardBg,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#f0f7f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <TicketIcon size={28} color={T.textMuted} strokeWidth={1.5} />
          </div>
          <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: T.textDark }}>No support tickets yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>
            When your team publishes a ticket for this lead, it will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tickets.map((ticket) => {
            const open = expandedId === ticket.id;
            const comments = commentsByTicket[ticket.id] ?? [];
            return (
              <div
                key={ticket.id}
                style={{
                  borderRadius: 12,
                  border: `1px solid ${T.border}`,
                  background: T.cardBg,
                  boxShadow: T.shadowSm,
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : ticket.id)}
                  aria-expanded={open}
                  aria-label={`${open ? "Collapse" : "Expand"} ticket: ${ticket.title}`}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 16,
                    padding: "14px 18px",
                    border: "none",
                    background: open ? "#f6faf6" : T.cardBg,
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: T.font,
                    outline: "none",
                    transition: "background-color 0.15s ease-in-out",
                  }}
                  className="focus-visible:ring-2 focus-visible:ring-[#233217]/40 focus-visible:ring-inset"
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.textDark, marginBottom: 4 }}>{ticket.title}</div>
                    <div style={{ fontSize: 12, color: T.textMuted, display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <span>
                        By {joinName(ticket.publisher) || "—"}
                      </span>
                      <span>·</span>
                      <span>{new Date(ticket.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                      {ticket.assignee_id && (
                        <>
                          <span>·</span>
                          <span>Assignee: {joinName(ticket.assignee) || ticket.assignee_id.slice(0, 8)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "4px 10px",
                        borderRadius: 6,
                        background: formatStatus(ticket.status).bg,
                        color: formatStatus(ticket.status).color,
                        textTransform: "uppercase",
                        letterSpacing: "0.3px",
                      }}
                    >
                      {formatStatus(ticket.status).label}
                    </span>
                    {open ? (
                      <ChevronUp size={18} color={T.textMuted} />
                    ) : (
                      <ChevronDown size={18} color={T.textMuted} />
                    )}
                  </div>
                </button>
                {open && (
                  <div
                    style={{
                      padding: "16px 18px 18px",
                      borderTop: `1px solid ${T.border}`,
                      background: "#fafdfb",
                    }}
                  >
                    {ticket.description ? (
                      <p style={{ margin: "0 0 16px", fontSize: 14, color: T.textDark, lineHeight: 1.55 }}>{ticket.description}</p>
                    ) : (
                      <p style={{ margin: "0 0 16px", fontSize: 13, color: T.textMuted }}>No description.</p>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <MessageSquare size={16} color={T.textMuted} strokeWidth={2} />
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.textDark }}>Comments</h4>
                    </div>
                    {threadLoading && <p style={{ margin: "0 0 10px", fontSize: 13, color: T.textMuted }}>Loading thread…</p>}
                    {!threadLoading && comments.length === 0 && (
                      <p style={{ margin: "0 0 10px", fontSize: 13, color: T.textMuted }}>No comments yet.</p>
                    )}
                    <ul style={{ listStyle: "none", margin: "0 0 14px", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                      {comments.map((comment) => {
                        const name = joinName(comment.users) || comment.user_id.slice(0, 8);
                        return (
                          <li
                            key={comment.id}
                            style={{
                              padding: "10px 12px",
                              borderRadius: T.radiusMd,
                              border: `1px solid ${T.border}`,
                              background: T.cardBg,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: T.textDark }}>{name}</span>
                              <span style={{ fontSize: 11, color: T.textMuted }}>
                                {new Date(comment.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: 14, color: T.textDark, lineHeight: 1.5 }}>{comment.body}</p>
                          </li>
                        );
                      })}
                    </ul>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <textarea
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        placeholder="Add a comment…"
                        rows={3}
                        aria-label="Write a comment"
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: `1px solid ${T.border}`,
                          fontSize: 14,
                          fontFamily: T.font,
                          resize: "vertical",
                          background: T.pageBg,
                          color: T.textDark,
                          outline: "none",
                          transition: "border-color 0.15s ease-in-out",
                        }}
                        className="focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
                      />
                      <button
                        type="button"
                        disabled={!commentDraft.trim() || actionBusy === `c-${ticket.id}`}
                        onClick={() => void postComment(ticket.id)}
                        aria-label="Post comment"
                        style={{
                          alignSelf: "flex-start",
                          padding: "8px 16px",
                          borderRadius: 10,
                          border: "none",
                          background: commentDraft.trim() && actionBusy !== `c-${ticket.id}` ? "#233217" : T.border,
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: commentDraft.trim() && actionBusy !== `c-${ticket.id}` ? "pointer" : "not-allowed",
                          fontFamily: T.font,
                          outline: "none",
                          transition: "all 0.15s ease-in-out",
                        }}
                        className="focus-visible:ring-2 focus-visible:ring-[#233217]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed"
                      >
                        {actionBusy === `c-${ticket.id}` ? "Posting…" : "Post comment"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
