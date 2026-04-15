"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, LifeBuoy, MessageSquare } from "lucide-react";
import { T } from "@/lib/theme";
import { Card } from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/ui";

type TicketStatus = "open" | "in_progress" | "solved";

type TicketRow = {
  id: string;
  lead_id: string;
  assignee_id: string | null;
  publisher_id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  publisher?: { full_name: string | null; email?: string | null } | { full_name: string | null; email?: string | null }[] | null;
  assignee?: { full_name: string | null; email?: string | null; department?: { name: string | null } | null } | { full_name: string | null; email?: string | null; department?: { name: string | null } | null }[] | null;
  lead?: { phone: string | null; first_name: string | null; last_name: string | null; lead_unique_id: string | null } | null;
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

function leadLabelFromTicket(ticket: TicketRow) {
  const lead = ticket.lead && !Array.isArray(ticket.lead) ? ticket.lead : Array.isArray(ticket.lead) ? ticket.lead[0] : null;
  return (
    lead?.lead_unique_id?.trim() ||
    [lead?.first_name, lead?.last_name].filter(Boolean).join(" ").trim() ||
    lead?.phone?.trim() ||
    "Lead"
  );
}

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

interface Props {
  ticketId: string;
  onBack: () => void;
  routeRole: string;
}

export default function TicketDetailPage({ ticketId, onBack, routeRole }: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

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

  const loadTicket = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from("tickets")
      .select(
        `
        id,
        lead_id,
        assignee_id,
        publisher_id,
        title,
        description,
        status,
        created_at,
        updated_at,
        publisher:users!tickets_publisher_id_fkey(full_name, email),
        assignee:users!tickets_assignee_id_fkey(full_name, email, department:departments!users_department_id_fkey(name)),
        lead:leads(phone, first_name, last_name, lead_unique_id)
      `,
      )
      .eq("id", ticketId)
      .maybeSingle();

    if (qErr) {
      setError(qErr.message);
      setTicket(null);
    } else {
      setTicket((data ?? null) as unknown as TicketRow | null);
    }
    setLoading(false);
  }, [supabase, ticketId]);

  const loadComments = useCallback(async () => {
    setThreadLoading(true);
    const { data, error: cErr } = await supabase
      .from("ticket_comments")
      .select("id, body, created_at, user_id, users(full_name)")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (!cErr) {
      setComments((data ?? []) as unknown as CommentRow[]);
    }
    setThreadLoading(false);
  }, [supabase, ticketId]);

  useEffect(() => {
    void loadTicket();
    void loadComments();
  }, [loadTicket, loadComments]);

  const postComment = async () => {
    if (!sessionUserId || !commentDraft.trim()) return;
    setActionBusy(true);
    setError(null);
    const { error: pErr } = await supabase.from("ticket_comments").insert({
      ticket_id: ticketId,
      user_id: sessionUserId,
      body: commentDraft.trim(),
    });
    setActionBusy(false);
    if (pErr) {
      setError(pErr.message);
      return;
    }
    setCommentDraft("");
    await loadComments();
  };

  const accent = "#233217";

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, fontFamily: T.font, color: T.textDark }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 10,
              border: `1px solid ${T.border}`,
              background: T.cardBg,
              color: T.textDark,
              fontSize: 13,
              fontWeight: 700,
              fontFamily: T.font,
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
        <div style={{ padding: 60, textAlign: "center", color: T.textMuted }}>Loading ticket...</div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, fontFamily: T.font, color: T.textDark }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 10,
              border: `1px solid ${T.border}`,
              background: T.cardBg,
              color: T.textDark,
              fontSize: 13,
              fontWeight: 700,
              fontFamily: T.font,
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
        <EmptyState title="Ticket not found" description="The ticket you are looking for does not exist or you do not have access to it." emoji="🎫" />
      </div>
    );
  }

  const leadLabel = leadLabelFromTicket(ticket);
  const publisherName = joinName(ticket.publisher) || "—";

  const assigneeData = ticket.assignee && !Array.isArray(ticket.assignee) ? ticket.assignee : Array.isArray(ticket.assignee) ? ticket.assignee[0] : null;
  const assigneeName = ticket.assignee_id ? (assigneeData?.full_name ?? ticket.assignee_id.slice(0, 8)) : "Unassigned";
  const assigneeDept = assigneeData?.department?.name || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, fontFamily: T.font, color: T.textDark }}>
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

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 10,
              border: `1px solid ${T.border}`,
              background: T.cardBg,
              color: T.textDark,
              fontSize: 13,
              fontWeight: 700,
              fontFamily: T.font,
              cursor: "pointer",
              transition: "all 0.15s ease-in-out",
            }}
          >
            <ArrowLeft size={16} />
            Back to tickets
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              padding: "6px 12px",
              borderRadius: 8,
              background: "#DCEBDC",
              color: accent,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {formatStatus(ticket.status)}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 380px)", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card
            style={{
              borderRadius: 16,
              border: `1px solid ${T.border}`,
              background: T.cardBg,
              boxShadow: T.shadowSm,
              padding: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: `color-mix(in srgb, ${accent} 15%, transparent)`,
                  color: accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <LifeBuoy size={24} strokeWidth={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: T.textDark, lineHeight: 1.2 }}>{ticket.title}</h1>
                <div style={{ fontSize: 13, color: T.textMuted, display: "flex", flexWrap: "wrap", gap: 12 }}>
                  <span>ID: {ticket.id}</span>
                  <span>·</span>
                  <span>Created: {formatDateTime(ticket.created_at)}</span>
                </div>
              </div>
            </div>

            {ticket.description ? (
              <div
                style={{
                  padding: "16px",
                  borderRadius: 12,
                  background: "#fafdfb",
                  border: `1px solid ${T.border}`,
                }}
              >
                <p style={{ margin: 0, fontSize: 14, color: T.textDark, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{ticket.description}</p>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 14, color: T.textMuted }}>No description provided.</p>
            )}
          </Card>

          <Card
            style={{
              borderRadius: 16,
              border: `1px solid ${T.border}`,
              background: T.cardBg,
              boxShadow: T.shadowSm,
              padding: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `color-mix(in srgb, ${accent} 15%, transparent)`,
                  color: accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MessageSquare size={20} strokeWidth={2} />
              </div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.textDark }}>Comments</h2>
            </div>

            {threadLoading && <p style={{ margin: 0, fontSize: 14, color: T.textMuted }}>Loading comments...</p>}

            {!threadLoading && comments.length === 0 && (
              <div
                style={{
                  padding: "32px 24px",
                  borderRadius: 12,
                  background: "#fafdfb",
                  border: `1px dashed ${T.border}`,
                  textAlign: "center",
                }}
              >
                <MessageSquare size={32} color={T.textMuted} style={{ marginBottom: 12, opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: 14, color: T.textMuted }}>No comments yet.</p>
                <p style={{ margin: "8px 0 0", fontSize: 13, color: T.textMuted }}>Be the first to add a comment.</p>
              </div>
            )}

            {!threadLoading && comments.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
                {comments.map((comment) => {
                  const name = joinName(comment.users) || comment.user_id.slice(0, 8);
                  const isCurrentUser = comment.user_id === sessionUserId;
                  return (
                    <div
                      key={comment.id}
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: isCurrentUser ? accent : T.border,
                          color: isCurrentUser ? "#fff" : T.textDark,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          padding: "14px 16px",
                          borderRadius: 12,
                          background: isCurrentUser ? "#f0f7f0" : T.pageBg,
                          border: `1px solid ${isCurrentUser ? "#c5e3c5" : T.border}`,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            marginBottom: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 800, color: T.textDark }}>{name}</span>
                          <span style={{ fontSize: 12, color: T.textMuted }}>{formatDateTime(comment.created_at)}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 14, color: T.textDark, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{comment.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {sessionUserId && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <textarea
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder="Add a comment..."
                  rows={4}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: `1px solid ${T.border}`,
                    fontSize: 14,
                    fontFamily: T.font,
                    resize: "vertical",
                    background: T.pageBg,
                    transition: "border-color 0.15s ease-in-out",
                  }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => void postComment()}
                    disabled={!commentDraft.trim() || actionBusy}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 10,
                      border: "none",
                      background: commentDraft.trim() && !actionBusy ? accent : T.border,
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 700,
                      fontFamily: T.font,
                      cursor: commentDraft.trim() && !actionBusy ? "pointer" : "not-allowed",
                      opacity: commentDraft.trim() && !actionBusy ? 1 : 0.6,
                      transition: "all 0.15s ease-in-out",
                    }}
                  >
                    {actionBusy ? "Posting..." : "Post comment"}
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card
            style={{
              borderRadius: 16,
              border: `1px solid ${T.border}`,
              background: T.cardBg,
              boxShadow: T.shadowSm,
              padding: "20px",
            }}
          >
            <h3
              style={{
                margin: "0 0 16px",
                fontSize: 12,
                fontWeight: 800,
                color: T.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Ticket Details
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                  Lead
                </div>
                <Link
                  href={`/dashboard/${routeRole}/leads/${ticket.lead_id}`}
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: T.blue,
                    textDecoration: "none",
                  }}
                >
                  {leadLabel}
                </Link>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                  Publisher
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.textDark }}>{publisherName}</div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                  Assignee
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.textDark }}>{assigneeName}</div>
                {assigneeDept && (
                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{assigneeDept}</div>
                )}
              </div>

              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                  Created
                </div>
                <div style={{ fontSize: 14, color: T.textDark }}>{formatDateTime(ticket.created_at)}</div>
              </div>

              {ticket.updated_at !== ticket.created_at && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                    Last Updated
                  </div>
                  <div style={{ fontSize: 14, color: T.textDark }}>{formatDateTime(ticket.updated_at)}</div>
                </div>
              )}
            </div>
          </Card>

          <Card
            style={{
              borderRadius: 16,
              border: `1px solid ${T.border}`,
              background: T.cardBg,
              boxShadow: T.shadowSm,
              padding: "20px",
            }}
          >
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: 12,
                fontWeight: 800,
                color: T.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Quick Links
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link
                href={`/dashboard/${routeRole}/leads/${ticket.lead_id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "#fafdfb",
                  border: `1px solid ${T.border}`,
                  color: T.textDark,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                  transition: "all 0.15s ease-in-out",
                }}
              >
                <ArrowLeft size={16} />
                View Lead Details
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
