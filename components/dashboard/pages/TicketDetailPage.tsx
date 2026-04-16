"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LifeBuoy, MessageSquare, UserPlus, X, Check } from "lucide-react";
import { T } from "@/lib/theme";
import { Card } from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  assignee?: { full_name: string | null; email?: string | null } | { full_name: string | null; email?: string | null }[] | null;
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

type UserOption = {
  id: string;
  full_name: string | null;
  email: string | null;
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
    [lead?.first_name, lead?.last_name].filter(Boolean).join(" ").trim() ||
    lead?.lead_unique_id?.trim() ||
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
  const [isPublisherManager, setIsPublisherManager] = useState(false);
  const [ticket, setTicket] = useState<TicketRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [followers, setFollowers] = useState<FollowerRow[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedFollowerId, setSelectedFollowerId] = useState<string>("");
  const [statusEditing, setStatusEditing] = useState(false);

  // Load session and check role
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
        setIsPublisherManager(false);
        return;
      }
      // Check if user has publisher_manager role
      const { data } = await supabase.from("users").select("roles(key)").eq("id", uid).maybeSingle();
      if (cancelled) return;
      const rel = data?.roles as { key?: string } | { key?: string }[] | null | undefined;
      const key = Array.isArray(rel) ? rel[0]?.key : rel?.key;
      setIsPublisherManager(key === "publisher_manager" || key === "system_admin");
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Load users for follower dropdown
  const loadUsers = useCallback(async () => {
    const { data, error: uErr } = await supabase
      .from("users")
      .select("id, full_name, email")
      .order("full_name", { ascending: true });
    if (!uErr && data) {
      setUsers(data as UserOption[]);
    }
  }, [supabase]);

  useEffect(() => {
    if (isPublisherManager) {
      void loadUsers();
    }
  }, [isPublisherManager, loadUsers]);

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
        assignee:users!tickets_assignee_id_fkey(full_name, email),
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

  const loadFollowers = useCallback(async () => {
    const { data, error: fErr } = await supabase
      .from("ticket_followers")
      .select("user_id, users(full_name)")
      .eq("ticket_id", ticketId);

    if (!fErr) {
      setFollowers((data ?? []) as unknown as FollowerRow[]);
    }
  }, [supabase, ticketId]);

  useEffect(() => {
    void loadTicket();
    void loadComments();
    void loadFollowers();
  }, [loadTicket, loadComments, loadFollowers]);

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

  const updateStatus = async (newStatus: TicketStatus) => {
    if (!isPublisherManager) return;
    setActionBusy(true);
    setError(null);
    const { error: uErr } = await supabase.from("tickets").update({ status: newStatus }).eq("id", ticketId);
    setActionBusy(false);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    setStatusEditing(false);
    await loadTicket();
  };

  const addFollower = async () => {
    if (!selectedFollowerId || !isPublisherManager) return;
    setActionBusy(true);
    setError(null);
    const { error: fErr } = await supabase.from("ticket_followers").insert({
      ticket_id: ticketId,
      user_id: selectedFollowerId,
    });
    setActionBusy(false);
    if (fErr) {
      setError(fErr.message);
      return;
    }
    setSelectedFollowerId("");
    await loadFollowers();
  };

  const removeFollower = async (userId: string) => {
    if (!isPublisherManager) return;
    setActionBusy(true);
    setError(null);
    const { error: dErr } = await supabase.from("ticket_followers").delete().eq("ticket_id", ticketId).eq("user_id", userId);
    setActionBusy(false);
    if (dErr) {
      setError(dErr.message);
      return;
    }
    await loadFollowers();
  };

  const accent = "#233217";

  // Filter out already followed users from dropdown
  const availableUsers = useMemo(() => {
    const followerIds = new Set(followers.map((f) => f.user_id));
    return users.filter((u) => !followerIds.has(u.id));
  }, [users, followers]);

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
  const assigneeName = joinName(ticket.assignee) || (ticket.assignee_id ? ticket.assignee_id.slice(0, 8) : "Unassigned");

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
          {isPublisherManager && statusEditing ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Select value={ticket.status} onValueChange={(val) => updateStatus(val as TicketStatus)}>
                <SelectTrigger
                  style={{
                    width: 140,
                    height: 38,
                    borderRadius: 10,
                    border: `1px solid ${T.border}`,
                    backgroundColor: T.cardBg,
                    color: T.textDark,
                    fontSize: 13,
                    fontWeight: 500,
                    paddingLeft: 14,
                    paddingRight: 12,
                    transition: "all 0.15s ease-in-out",
                  }}
                  className="hover:border-[#233217] focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
                >
                  <SelectValue />
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
                  <SelectItem
                    value="open"
                    style={{
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 13,
                      fontWeight: 400,
                      color: T.textDark,
                      cursor: "pointer",
                    }}
                    className="hover:bg-[#DCEBDC] hover:text-[#233217] focus:bg-[#DCEBDC] focus:text-[#233217] data-[state=checked]:bg-[#233217] data-[state=checked]:text-white data-[state=checked]:font-semibold"
                  >
                    Open
                  </SelectItem>
                  <SelectItem
                    value="in_progress"
                    style={{
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 13,
                      fontWeight: 400,
                      color: T.textDark,
                      cursor: "pointer",
                    }}
                    className="hover:bg-[#DCEBDC] hover:text-[#233217] focus:bg-[#DCEBDC] focus:text-[#233217] data-[state=checked]:bg-[#233217] data-[state=checked]:text-white data-[state=checked]:font-semibold"
                  >
                    In progress
                  </SelectItem>
                  <SelectItem
                    value="solved"
                    style={{
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 13,
                      fontWeight: 400,
                      color: T.textDark,
                      cursor: "pointer",
                    }}
                    className="hover:bg-[#DCEBDC] hover:text-[#233217] focus:bg-[#DCEBDC] focus:text-[#233217] data-[state=checked]:bg-[#233217] data-[state=checked]:text-white data-[state=checked]:font-semibold"
                  >
                    Solved
                  </SelectItem>
                </SelectContent>
              </Select>
              <button
                onClick={() => setStatusEditing(false)}
                style={{
                  padding: "6px",
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={18} color={T.textMuted} />
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
              {isPublisherManager && (
                <button
                  onClick={() => setStatusEditing(true)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    background: T.cardBg,
                    fontSize: 12,
                    fontWeight: 600,
                    color: T.textDark,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  Edit
                </button>
              )}
            </div>
          )}
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

          {/* Followers Section */}
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
              Followers
            </h3>

            {followers.length === 0 ? (
              <p style={{ margin: "0 0 16px", fontSize: 14, color: T.textMuted }}>No followers yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {followers.map((follower) => {
                  const name = joinName(follower.users) || follower.user_id.slice(0, 8);
                  return (
                    <div
                      key={follower.user_id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: T.pageBg,
                        border: `1px solid ${T.border}`,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: accent,
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.textDark }}>{name}</span>
                      </div>
                      {isPublisherManager && (
                        <button
                          onClick={() => void removeFollower(follower.user_id)}
                          disabled={actionBusy}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <X size={16} color="#991b1b" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {isPublisherManager && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Select value={selectedFollowerId} onValueChange={(val) => setSelectedFollowerId(val || "")}>
                  <SelectTrigger
                    style={{
                      width: "100%",
                      height: 38,
                      borderRadius: 10,
                      border: `1px solid ${T.border}`,
                      backgroundColor: T.cardBg,
                      color: selectedFollowerId ? T.textDark : T.textMuted,
                      fontSize: 13,
                      fontWeight: 500,
                      paddingLeft: 14,
                      paddingRight: 12,
                      transition: "all 0.15s ease-in-out",
                    }}
                    className="hover:border-[#233217] focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
                  >
                    <SelectValue placeholder="Select a user to add..." />
                  </SelectTrigger>
                  <SelectContent
                    style={{
                      borderRadius: 12,
                      border: `1px solid ${T.border}`,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                      backgroundColor: T.cardBg,
                      padding: 6,
                      maxHeight: 300,
                    }}
                  >
                    {availableUsers.length === 0 ? (
                      <div style={{ padding: "12px 16px", fontSize: 13, color: T.textMuted }}>No available users</div>
                    ) : (
                      availableUsers.map((user) => (
                        <SelectItem
                          key={user.id}
                          value={user.id}
                          style={{
                            borderRadius: 8,
                            padding: "10px 14px",
                            fontSize: 13,
                            fontWeight: 400,
                            color: T.textDark,
                            cursor: "pointer",
                          }}
                          className="hover:bg-[#DCEBDC] hover:text-[#233217] focus:bg-[#DCEBDC] focus:text-[#233217] data-[state=checked]:bg-[#233217] data-[state=checked]:text-white data-[state=checked]:font-semibold"
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontWeight: 600 }}>{user.full_name || "Unnamed"}</span>
                            {user.email && <span style={{ fontSize: 11, color: T.textMuted }}>{user.email}</span>}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <button
                  onClick={() => void addFollower()}
                  disabled={!selectedFollowerId || actionBusy}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: "none",
                    background: selectedFollowerId && !actionBusy ? accent : T.border,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: T.font,
                    cursor: selectedFollowerId && !actionBusy ? "pointer" : "not-allowed",
                    opacity: selectedFollowerId && !actionBusy ? 1 : 0.6,
                    transition: "all 0.15s ease-in-out",
                  }}
                >
                  <UserPlus size={16} />
                  {actionBusy ? "Adding..." : "Add follower"}
                </button>
              </div>
            )}
          </Card>

          {routeRole !== "publisher_manager" && (
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
          )}
        </div>
      </div>
    </div>
  );
}
