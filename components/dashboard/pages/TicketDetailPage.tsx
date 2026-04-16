"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, MessageSquare, Pencil, UserPlus, X } from "lucide-react";
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
  roles?: { key: string }[];
};

const EXCLUDED_FOLLOWER_ROLES = ["call_center_admin", "call_center_agent"];

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
  const [statusModalOpen, setStatusModalOpen] = useState(false);

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
      .select("id, full_name, email, roles(key)")
      .order("full_name", { ascending: true });
    if (!uErr && data) {
      const filtered = (data as unknown as UserOption[]).filter((user) => {
        const roles = user.roles;
        if (!roles) return true;
        const roleArray = Array.isArray(roles) ? roles : [roles];
        const roleKeys = roleArray.map((r: { key?: string }) => r.key).filter(Boolean);
        return !roleKeys.some((key) => EXCLUDED_FOLLOWER_ROLES.includes(key!));
      });
      setUsers(filtered);
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
    setStatusModalOpen(false);
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
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={onBack}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              color: T.textMuted,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 6,
              transition: "all 0.15s ease-in-out",
              outline: "none",
            }}
            className="hover:text-[#233217] hover:bg-[#f6faf6] focus-visible:ring-2 focus-visible:ring-[#233217]/40"
          >
            <ArrowLeft size={14} />
            Support Tickets
          </button>
          <ChevronRight size={14} color={T.textMuted} />
          <span style={{ fontSize: 13, fontWeight: 600, color: T.textMuted }}>Loading...</span>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, fontFamily: T.font, color: T.textDark }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={onBack}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              color: T.textMuted,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 6,
              transition: "all 0.15s ease-in-out",
              outline: "none",
            }}
            className="hover:text-[#233217] hover:bg-[#f6faf6] focus-visible:ring-2 focus-visible:ring-[#233217]/40"
          >
            <ArrowLeft size={14} />
            Support Tickets
          </button>
          <ChevronRight size={14} color={T.textMuted} />
          <span style={{ fontSize: 13, fontWeight: 600, color: T.textMuted }}>Not found</span>
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

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={onBack}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              color: T.textMuted,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 6,
              transition: "all 0.15s ease-in-out",
              outline: "none",
            }}
            className="hover:text-[#233217] hover:bg-[#f6faf6] focus-visible:ring-2 focus-visible:ring-[#233217]/40"
          >
            <ArrowLeft size={14} />
            Support Tickets
          </button>
          <ChevronRight size={14} color={T.textMuted} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#233217" }}>
            {ticket.title.slice(0, 40)}{ticket.title.length > 40 ? "..." : ""}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "5px 10px",
              borderRadius: 6,
              background: formatStatus(ticket.status).bg,
              color: formatStatus(ticket.status).color,
              textTransform: "uppercase",
              letterSpacing: "0.4px",
            }}
          >
            {formatStatus(ticket.status).label}
          </span>
          {isPublisherManager && (
            <button
              onClick={() => setStatusModalOpen(true)}
              aria-label="Edit ticket status"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: T.cardBg,
                fontSize: 12,
                fontWeight: 600,
                color: T.textDark,
                cursor: "pointer",
                outline: "none",
                transition: "all 0.15s ease-in-out",
              }}
              className="hover:border-[#233217] focus-visible:ring-2 focus-visible:ring-[#233217]/40"
            >
              <Pencil size={13} />
              Edit
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 320px)", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card
            style={{
              borderRadius: 16,
              border: `1px solid ${T.border}`,
              background: T.cardBg,
              boxShadow: T.shadowSm,
              padding: "20px",
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <h1 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: T.textDark, lineHeight: 1.3 }}>{ticket.title}</h1>
              <p style={{ margin: 0, fontSize: 12, color: T.textMuted }}>
                Created {formatDateTime(ticket.created_at)}
              </p>
            </div>

            {ticket.description ? (
              <p style={{ margin: 0, fontSize: 14, color: T.textDark, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{ticket.description}</p>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>No description provided.</p>
            )}
          </Card>

          <Card
            style={{
              borderRadius: 16,
              border: `1px solid ${T.border}`,
              background: T.cardBg,
              boxShadow: T.shadowSm,
              padding: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <MessageSquare size={16} color={T.textMuted} strokeWidth={2} />
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.textDark }}>Comments ({comments.length})</h2>
            </div>

            {threadLoading && (
              <div style={{ padding: 16, textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>Loading...</p>
              </div>
            )}

            {!threadLoading && comments.length === 0 && (
              <div
                style={{
                  padding: "16px 12px",
                  borderRadius: 8,
                  background: "#fafdfb",
                  border: `1px dashed ${T.border}`,
                  textAlign: "center",
                }}
              >
                <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>No comments yet.</p>
              </div>
            )}

            {!threadLoading && comments.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                {comments.map((comment) => {
                  const name = joinName(comment.users) || comment.user_id.slice(0, 8);
                  const isCurrentUser = comment.user_id === sessionUserId;
                  return (
                    <div
                      key={comment.id}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: isCurrentUser ? accent : T.border,
                          color: isCurrentUser ? "#fff" : T.textDark,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          padding: "10px 12px",
                          borderRadius: 8,
                          background: isCurrentUser ? "#f0f7f0" : T.pageBg,
                          border: `1px solid ${isCurrentUser ? "#c5e3c5" : T.border}`,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 4,
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 600, color: T.textDark }}>{name}</span>
                          <span style={{ fontSize: 10, color: T.textMuted }}>{formatDateTime(comment.created_at)}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: T.textDark, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{comment.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {sessionUserId && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <textarea
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder="Write a comment..."
                  rows={2}
                  aria-label="Write a comment"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    fontSize: 13,
                    fontFamily: T.font,
                    resize: "vertical",
                    background: T.pageBg,
                    outline: "none",
                    transition: "border-color 0.15s ease-in-out",
                  }}
                  className="focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
                />
                <button
                  type="button"
                  onClick={() => void postComment()}
                  disabled={!commentDraft.trim() || actionBusy}
                  aria-label="Post comment"
                  style={{
                    alignSelf: "flex-end",
                    padding: "6px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: commentDraft.trim() && !actionBusy ? accent : T.border,
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: T.font,
                    cursor: commentDraft.trim() && !actionBusy ? "pointer" : "not-allowed",
                    opacity: commentDraft.trim() && !actionBusy ? 1 : 0.6,
                    transition: "all 0.15s ease-in-out",
                    outline: "none",
                  }}
                  className="focus-visible:ring-2 focus-visible:ring-[#233217]/40 disabled:cursor-not-allowed"
                >
                  {actionBusy ? "Posting..." : "Post"}
                </button>
              </div>
            )}
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card
            style={{
              borderRadius: 16,
              border: `1px solid ${T.border}`,
              background: T.cardBg,
              boxShadow: T.shadowSm,
              padding: "16px",
            }}
          >
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: 11,
                fontWeight: 700,
                color: T.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Details
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>
                  Lead
                </div>
                <Link
                  href={`/dashboard/${routeRole}/leads/${ticket.lead_id}`}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#2d6a2d",
                    textDecoration: "none",
                  }}
                  className="hover:underline"
                >
                  {leadLabel}
                </Link>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>
                    Publisher
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.textDark }}>{publisherName}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>
                    Assignee
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.textDark }}>{assigneeName}</div>
                </div>
              </div>
            </div>
          </Card>

          <Card
            style={{
              borderRadius: 16,
              border: `1px solid ${T.border}`,
              background: T.cardBg,
              boxShadow: T.shadowSm,
              padding: "16px",
            }}
          >
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: 11,
                fontWeight: 700,
                color: T.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Followers ({followers.length})
            </h3>

            {followers.length === 0 && (
              <p style={{ margin: "0 0 12px", fontSize: 12, color: T.textMuted }}>No followers.</p>
            )}

            {followers.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                {followers.map((follower) => {
                  const name = joinName(follower.users) || follower.user_id.slice(0, 8);
                  return (
                    <div
                      key={follower.user_id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 8px",
                        borderRadius: 8,
                        background: T.pageBg,
                        border: `1px solid ${T.border}`,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: accent,
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: T.textDark }}>{name}</span>
                      </div>
                      {isPublisherManager && (
                        <button
                          onClick={() => void removeFollower(follower.user_id)}
                          disabled={actionBusy}
                          aria-label={`Remove ${name}`}
                          style={{
                            padding: 4,
                            borderRadius: 4,
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            outline: "none",
                          }}
                          className="focus-visible:ring-2 focus-visible:ring-red-500/40"
                        >
                          <X size={14} color="#991b1b" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {isPublisherManager && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Select value={selectedFollowerId} onValueChange={(val) => setSelectedFollowerId(val || "")}>
                  <SelectTrigger
                    style={{
                      width: "100%",
                      height: 34,
                      borderRadius: 8,
                      border: `1px solid ${T.border}`,
                      backgroundColor: T.cardBg,
                      color: selectedFollowerId ? T.textDark : T.textMuted,
                      fontSize: 12,
                      fontWeight: 500,
                      paddingLeft: 10,
                      paddingRight: 8,
                    }}
                    className="hover:border-[#233217] focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
                  >
                    <SelectValue placeholder="Add follower..." />
                  </SelectTrigger>
                  <SelectContent
                    style={{
                      borderRadius: 10,
                      border: `1px solid ${T.border}`,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                      backgroundColor: T.cardBg,
                      padding: 4,
                    }}
                  >
                    {availableUsers.length === 0 ? (
                      <div style={{ padding: "8px 12px", fontSize: 12, color: T.textMuted }}>No users</div>
                    ) : (
                      availableUsers.map((user) => (
                        <SelectItem
                          key={user.id}
                          value={user.id}
                          style={{
                            borderRadius: 6,
                            padding: "8px 10px",
                            fontSize: 12,
                            fontWeight: 400,
                            color: T.textDark,
                            cursor: "pointer",
                          }}
                          className="hover:bg-[#DCEBDC] focus:bg-[#DCEBDC] data-[state=checked]:bg-[#233217] data-[state=checked]:text-white"
                        >
                          <span style={{ fontWeight: 600 }}>{user.full_name || "Unnamed"}</span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedFollowerId && (
                  <button
                    onClick={() => void addFollower()}
                    disabled={!selectedFollowerId || actionBusy}
                    aria-label="Add follower"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: accent,
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: T.font,
                      cursor: "pointer",
                      transition: "all 0.15s ease-in-out",
                      outline: "none",
                    }}
                    className="focus-visible:ring-2 focus-visible:ring-[#233217]/40"
                  >
                    <UserPlus size={14} />
                    {actionBusy ? "Adding..." : "Add"}
                  </button>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {statusModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(4px)",
            }}
            onClick={() => setStatusModalOpen(false)}
          />
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 400,
              background: T.cardBg,
              borderRadius: 16,
              border: `1px solid ${T.border}`,
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              padding: 24,
              zIndex: 101,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.textDark }}>Edit Status</h2>
              <button
                onClick={() => setStatusModalOpen(false)}
                aria-label="Close"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 6,
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  outline: "none",
                  transition: "all 0.15s ease-in-out",
                }}
                className="hover:bg-[#f0f0f0] focus-visible:ring-2 focus-visible:ring-[#233217]/40"
              >
                <X size={18} color={T.textMuted} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {(["open", "in_progress", "solved"] as TicketStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => void updateStatus(status)}
                  disabled={actionBusy || ticket.status === status}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    borderRadius: 10,
                    border: `1px solid ${ticket.status === status ? formatStatus(status).color : T.border}`,
                    background: ticket.status === status ? formatStatus(status).bg : T.cardBg,
                    cursor: ticket.status === status ? "default" : "pointer",
                    transition: "all 0.15s ease-in-out",
                    outline: "none",
                    opacity: ticket.status === status ? 1 : 0.8,
                  }}
                  className={`${ticket.status !== status ? "hover:border-[#233217] focus-visible:ring-2 focus-visible:ring-[#233217]/40" : ""}`}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: formatStatus(status).color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: ticket.status === status ? formatStatus(status).color : T.textDark,
                    }}
                  >
                    {formatStatus(status).label}
                  </span>
                  {ticket.status === status && (
                    <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: formatStatus(status).color }}>
                      Current
                    </span>
                  )}
                </button>
              ))}
            </div>

            {actionBusy && (
              <p style={{ margin: 0, fontSize: 12, color: T.textMuted, textAlign: "center" }}>
                Updating...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
