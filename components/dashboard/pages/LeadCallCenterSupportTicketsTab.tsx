"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <p style={{ margin: 0, fontSize: 13, color: T.textMuted, lineHeight: 1.5, maxWidth: 720 }}>
          Tickets your call center raised for this lead (visible to all admins in your center). Use{" "}
          <strong>New ticket</strong> above to publish another request to your Publisher Manager.
        </p>
        <button
          type="button"
          onClick={() => void loadTickets()}
          disabled={loading}
          style={{
            padding: "8px 16px",
            borderRadius: 10,
            border: `1px solid ${T.border}`,
            background: T.cardBg,
            color: "#233217",
            fontSize: 13,
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
            fontFamily: T.font,
          }}
        >
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
        <div style={{ padding: 48, textAlign: "center", color: T.textMuted, fontWeight: 600 }}>Loading tickets…</div>
      ) : tickets.length === 0 ? (
        <EmptyState title="No support tickets yet" description="When your team publishes a ticket for this lead, it will appear here." emoji="🎫" />
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
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: T.textDark, marginBottom: 4 }}>{ticket.title}</div>
                    <div style={{ fontSize: 12, color: T.textMuted, display: "flex", flexWrap: "wrap", gap: 10 }}>
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
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: 8,
                      background: "#DCEBDC",
                      color: "#233217",
                    }}
                  >
                    {formatStatus(ticket.status)}
                  </span>
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
                    <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800, color: T.textDark }}>Comments</h4>
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
                              <span style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>{name}</span>
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
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "10px 12px",
                          borderRadius: T.radiusSm,
                          border: `1px solid ${T.border}`,
                          fontSize: 14,
                          fontFamily: T.font,
                          resize: "vertical",
                        }}
                      />
                      <button
                        type="button"
                        disabled={!commentDraft.trim() || actionBusy === `c-${ticket.id}`}
                        onClick={() => void postComment(ticket.id)}
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
                        }}
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
