"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LifeBuoy } from "lucide-react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { LeadCard } from "./LeadCard";
import { EmptyState } from "@/components/ui";

export type TicketStatus = "open" | "in_progress" | "solved";

type TicketRow = {
  id: string;
  lead_id: string;
  publisher_id: string;
  assignee_id: string | null;
  title: string;
  description: string | null;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  publisher?: { full_name: string | null } | null;
  assignee?: { full_name: string | null } | null;
};

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  users?: { full_name: string | null } | null;
};

type FollowerRow = {
  user_id: string;
  users?: { full_name: string | null } | null;
};

function formatTicketStatus(s: TicketStatus): string {
  if (s === "in_progress") return "In progress";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
}

/** PostgREST may return embedded `users` as object or single-element array. */
function joinFullName(rel: unknown): string | null {
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
  /** `leads.call_center_id` — center admins must match this to create tickets */
  leadCallCenterId?: string | null;
  sessionUserId: string | null;
  isCreation?: boolean;
  previewMode?: boolean;
};

export default function LeadTicketsTab({
  leadId,
  leadCallCenterId = null,
  sessionUserId,
  isCreation = false,
  previewMode = false,
}: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [userRoleKey, setUserRoleKey] = useState<string | null>(null);
  const [userCallCenterId, setUserCallCenterId] = useState<string | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commentsByTicket, setCommentsByTicket] = useState<Record<string, CommentRow[]>>({});
  const [followersByTicket, setFollowersByTicket] = useState<Record<string, FollowerRow[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const [commentDraft, setCommentDraft] = useState("");
  const [followerUserId, setFollowerUserId] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const isCenterAdminSameCenter =
    userRoleKey === "call_center_admin" &&
    !!leadCallCenterId &&
    !!userCallCenterId &&
    leadCallCenterId === userCallCenterId;

  const canCreateTicket =
    !!sessionUserId &&
    !previewMode &&
    !isCreation &&
    !!leadId &&
    (isSystemAdmin || isCenterAdminSameCenter);

  const loadTickets = useCallback(async () => {
    if (!leadId || previewMode || isCreation) {
      setTickets([]);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: qError } = await supabase
      .from("tickets")
      .select(
        `
        id,
        lead_id,
        publisher_id,
        assignee_id,
        title,
        description,
        status,
        created_at,
        updated_at,
        publisher:users!tickets_publisher_id_fkey(full_name),
        assignee:users!tickets_assignee_id_fkey(full_name)
      `,
      )
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (qError) {
      setError(qError.message);
      setTickets([]);
    } else {
      setTickets((data ?? []) as unknown as TicketRow[]);
    }
    setLoading(false);
  }, [supabase, leadId, previewMode, isCreation]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sessionUserId) {
        setIsSystemAdmin(false);
        setUserRoleKey(null);
        setUserCallCenterId(null);
        setRoleChecked(true);
        return;
      }
      const { data, error: rErr } = await supabase
        .from("users")
        .select("call_center_id, roles(key)")
        .eq("id", sessionUserId)
        .maybeSingle();
      if (cancelled) return;
      if (rErr || !data) {
        setIsSystemAdmin(false);
        setUserRoleKey(null);
        setUserCallCenterId(null);
      } else {
        const rel = data.roles as { key?: string } | { key?: string }[] | null;
        const key = Array.isArray(rel) ? rel[0]?.key : rel?.key;
        setUserRoleKey(key ?? null);
        setIsSystemAdmin(key === "system_admin");
        setUserCallCenterId(data.call_center_id != null ? String(data.call_center_id) : null);
      }
      setRoleChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionUserId, supabase]);

  const loadThread = useCallback(
    async (ticketId: string) => {
      setCommentsLoading(ticketId);
      const [cRes, fRes] = await Promise.all([
        supabase
          .from("ticket_comments")
          .select("id, body, created_at, user_id, users(full_name)")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: true }),
        supabase.from("ticket_followers").select("user_id, users(full_name)").eq("ticket_id", ticketId),
      ]);
      if (!cRes.error) {
        setCommentsByTicket((prev) => ({ ...prev, [ticketId]: ((cRes.data ?? []) as unknown as CommentRow[]) }));
      }
      if (!fRes.error) {
        setFollowersByTicket((prev) => ({ ...prev, [ticketId]: ((fRes.data ?? []) as unknown as FollowerRow[]) }));
      }
      setCommentsLoading(null);
    },
    [supabase],
  );

  useEffect(() => {
    if (expandedId) void loadThread(expandedId);
  }, [expandedId, loadThread]);

  useEffect(() => {
    setCommentDraft("");
    setFollowerUserId("");
  }, [expandedId]);

  const createTicket = async () => {
    if (!leadId || !sessionUserId || !newTitle.trim()) return;
    setCreating(true);
    setError(null);
    const { error: insErr } = await supabase.from("tickets").insert({
      lead_id: leadId,
      publisher_id: sessionUserId,
      title: newTitle.trim(),
      description: newDescription.trim() || null,
    });
    setCreating(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setNewTitle("");
    setNewDescription("");
    await loadTickets();
  };

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

  const addFollower = async (ticketId: string) => {
    const uid = followerUserId.trim();
    if (!isUuid(uid)) {
      setError("Follower user id must be a valid UUID.");
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
    setActionBusy(`rf-${ticketId}-${userId}`);
    setError(null);
    const { error: dErr } = await supabase.from("ticket_followers").delete().eq("ticket_id", ticketId).eq("user_id", userId);
    setActionBusy(null);
    if (dErr) {
      setError(dErr.message);
      return;
    }
    await loadThread(ticketId);
  };

  if (isCreation || previewMode) {
    return (
      <LeadCard icon="🎫" title="Support tickets" subtitle="Not available" collapsible={false}>
        <p style={{ margin: 0, fontSize: 14, color: T.textMuted, fontFamily: T.font }}>
          Tickets are not available in {isCreation ? "creation" : "preview"} mode.
        </p>
      </LeadCard>
    );
  }

  if (!leadId) {
    return <EmptyState title="No lead" description="Load a lead to view support tickets." />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: T.font }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: T.textDark }}>
        <LifeBuoy size={22} strokeWidth={2} />
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Support tickets</h2>
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

      {canCreateTicket && roleChecked && (
        <LeadCard icon="➕" title="Create ticket" subtitle="Center admins: ticket is visible to assignee, followers, and admins" collapsible={false}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="text"
              placeholder="Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: T.radiusSm,
                border: `1px solid ${T.border}`,
                fontSize: 14,
                fontFamily: T.font,
              }}
            />
            <textarea
              placeholder="Description (optional)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={3}
              style={{
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
              disabled={creating || !newTitle.trim()}
              onClick={() => void createTicket()}
              style={{
                alignSelf: "flex-start",
                padding: "10px 20px",
                borderRadius: T.radiusMd,
                border: "none",
                background: creating || !newTitle.trim() ? T.border : "#233217",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: creating || !newTitle.trim() ? "not-allowed" : "pointer",
              }}
            >
              {creating ? "Creating…" : "Create ticket"}
            </button>
          </div>
        </LeadCard>
      )}

      {loading && (
        <LeadCard icon="🎫" title="Tickets" subtitle="Loading…" collapsible={false}>
          <p style={{ margin: 0, color: T.textMuted, fontSize: 14 }}>Loading tickets…</p>
        </LeadCard>
      )}

      {!loading && tickets.length === 0 && (
        <EmptyState
          title="No tickets yet"
          description={
            canCreateTicket
              ? "Create a ticket to reach your publisher manager or support queue."
              : "Only call center admins (this center) or system admins can create tickets. You will see tickets you published, are assigned to, or follow."
          }
        />
      )}

      {!loading &&
        tickets.map((t) => {
          const isExpanded = expandedId === t.id;
          const isAssignee = sessionUserId != null && t.assignee_id === sessionUserId;
          const canModerate = isAssignee || isSystemAdmin;
          const comments = commentsByTicket[t.id] ?? [];
          const followers = followersByTicket[t.id] ?? [];

          return (
            <LeadCard
              key={t.id}
              icon="🎫"
              title={t.title}
              subtitle={`${formatTicketStatus(t.status)} · ${new Date(t.created_at).toLocaleString()}`}
              collapsible={false}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  style={{
                    alignSelf: "flex-start",
                    padding: "6px 12px",
                    borderRadius: T.radiusSm,
                    border: `1px solid ${T.border}`,
                    background: T.blueFaint,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#233217",
                    cursor: "pointer",
                    fontFamily: T.font,
                  }}
                >
                  {isExpanded ? "Hide comments & followers" : "Show comments & followers"}
                </button>
                <div style={{ fontSize: 13, color: T.textMuted }}>
                  <div>
                    <strong style={{ color: T.textMid }}>Publisher:</strong>{" "}
                    {joinFullName(t.publisher) || t.publisher_id}
                  </div>
                  <div>
                    <strong style={{ color: T.textMid }}>Assignee:</strong>{" "}
                    {joinFullName(t.assignee) || t.assignee_id || "Unassigned"}
                  </div>
                </div>
                {t.description && (
                  <p style={{ margin: 0, fontSize: 14, color: T.textDark, lineHeight: 1.5 }}>{t.description}</p>
                )}

                {canModerate && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    <label style={{ fontSize: 13, color: T.textMid, fontWeight: 600 }}>Status</label>
                    <select
                      value={t.status}
                      disabled={actionBusy === t.id}
                      onChange={(e) => void updateStatus(t.id, e.target.value as TicketStatus)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: T.radiusSm,
                        border: `1px solid ${T.border}`,
                        fontSize: 13,
                        fontFamily: T.font,
                      }}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="solved">Solved</option>
                    </select>
                  </div>
                )}

                {!canModerate && (
                  <div style={{ fontSize: 13, color: T.textMuted }}>
                    Status: <strong style={{ color: T.textMid }}>{formatTicketStatus(t.status)}</strong>
                  </div>
                )}

                {isExpanded && (
                  <>
                    <div style={{ borderTop: `1px solid ${T.borderLight}`, paddingTop: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.textDark, marginBottom: 8 }}>Comments</div>
                      {commentsLoading === t.id && <p style={{ color: T.textMuted, fontSize: 13 }}>Loading thread…</p>}
                      {comments.length === 0 && commentsLoading !== t.id && (
                        <p style={{ color: T.textMuted, fontSize: 13 }}>No comments yet.</p>
                      )}
                      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                        {comments.map((c) => (
                          <li
                            key={c.id}
                            style={{
                              padding: "10px 12px",
                              background: T.blueFaint,
                              borderRadius: T.radiusSm,
                              fontSize: 13,
                            }}
                          >
                            <div style={{ fontWeight: 600, color: T.textMid }}>
                              {joinFullName(c.users) || c.user_id}{" "}
                              <span style={{ fontWeight: 400, color: T.textMuted }}>
                                · {new Date(c.created_at).toLocaleString()}
                              </span>
                            </div>
                            <div style={{ marginTop: 4, color: T.textDark, whiteSpace: "pre-wrap" }}>{c.body}</div>
                          </li>
                        ))}
                      </ul>
                      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                        <textarea
                          placeholder="Write a comment…"
                          value={commentDraft}
                          onChange={(e) => setCommentDraft(e.target.value)}
                          rows={2}
                          style={{
                            padding: "10px 12px",
                            borderRadius: T.radiusSm,
                            border: `1px solid ${T.border}`,
                            fontSize: 13,
                            fontFamily: T.font,
                            resize: "vertical",
                          }}
                        />
                        <button
                          type="button"
                          disabled={!commentDraft.trim() || actionBusy === `c-${t.id}`}
                          onClick={() => void postComment(t.id)}
                          style={{
                            alignSelf: "flex-start",
                            padding: "8px 16px",
                            borderRadius: T.radiusSm,
                            border: "none",
                            background: "#233217",
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: !commentDraft.trim() ? "not-allowed" : "pointer",
                            opacity: !commentDraft.trim() ? 0.5 : 1,
                          }}
                        >
                          {actionBusy === `c-${t.id}` ? "Posting…" : "Post comment"}
                        </button>
                      </div>
                    </div>

                    <div style={{ borderTop: `1px solid ${T.borderLight}`, paddingTop: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.textDark, marginBottom: 8 }}>Followers</div>
                      {followers.length === 0 && <p style={{ color: T.textMuted, fontSize: 13 }}>No followers yet.</p>}
                      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                        {followers.map((f) => (
                          <li
                            key={f.user_id}
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 13 }}
                          >
                            <span>{joinFullName(f.users) || f.user_id}</span>
                            {canModerate && (
                              <button
                                type="button"
                                disabled={actionBusy === `rf-${t.id}-${f.user_id}`}
                                onClick={() => void removeFollower(t.id, f.user_id)}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  color: T.danger,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Remove
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                      {canModerate && (
                        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                          <input
                            type="text"
                            placeholder="User UUID to follow"
                            value={followerUserId}
                            onChange={(e) => setFollowerUserId(e.target.value)}
                            style={{
                              flex: "1 1 200px",
                              minWidth: 160,
                              padding: "8px 10px",
                              borderRadius: T.radiusSm,
                              border: `1px solid ${T.border}`,
                              fontSize: 13,
                              fontFamily: T.font,
                            }}
                          />
                          <button
                            type="button"
                            disabled={actionBusy === `f-${t.id}`}
                            onClick={() => void addFollower(t.id)}
                            style={{
                              padding: "8px 14px",
                              borderRadius: T.radiusSm,
                              border: `1px solid ${T.border}`,
                              background: T.cardBg,
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Add follower
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </LeadCard>
          );
        })}
    </div>
  );
}
