"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, Loader2, RefreshCw, X } from "lucide-react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  fetchQueueAssignees,
  fetchQueueSnapshot,
  managerAssignQueueItem,
  resolveQueueRole,
  sendQueueTransfer,
  type LeadQueueItem,
} from "@/lib/queue/queueClient";
import type { RoleKey } from "@/lib/auth/roles";

type Props = {
  currentRole: RoleKey;
  currentUserId: string | null;
};

type DraftAssign = {
  baId: string;
  laId: string;
  eta: string;
};

function elapsedLabel(iso: string | null): string {
  if (!iso) return "N/A";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "N/A";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hours}h ${rem}m`;
}

export default function GlobalQueueWidget({ currentRole, currentUserId }: Props) {
  const queueRole = useMemo(() => resolveQueueRole(currentRole), [currentRole]);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<LeadQueueItem[]>([]);
  const [assignees, setAssignees] = useState<Array<{ id: string; name: string; queueRole: "ba" | "la" }>>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftAssign>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const loadSnapshot = useCallback(async (silent = false) => {
    if (queueRole === "none") return;
    if (silent) setRefreshing(true);
    else setLoading(true);
    if (!silent) setError(null);
    try {
      const [queueRows, agents] = await Promise.all([
        fetchQueueSnapshot(supabase, queueRole, currentUserId),
        queueRole === "manager" ? fetchQueueAssignees(supabase) : Promise.resolve([]),
      ]);
      setRows(queueRows);
      setAssignees(agents);
      setLastUpdatedAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load queue");
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [queueRole, supabase, currentUserId]);

  useEffect(() => {
    if (!open || queueRole === "none") return;
    void loadSnapshot();
    const timer = window.setInterval(() => {
      void loadSnapshot(true);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [open, queueRole, loadSnapshot]);

  const grouped = useMemo(
    () => ({
      unclaimed: rows.filter((r) => r.queue_type === "unclaimed_transfer"),
      baActive: rows.filter((r) => r.queue_type === "ba_active"),
      laActive: rows.filter((r) => r.queue_type === "la_active"),
    }),
    [rows],
  );
  const assignedToMe = useMemo(() => {
    if (!currentUserId) return [] as LeadQueueItem[];
    return rows.filter((r) => {
      if (r.queue_type !== "unclaimed_transfer") return false;
      return queueRole === "la" ? r.assigned_la_id === currentUserId : r.assigned_ba_id === currentUserId;
    });
  }, [rows, currentUserId, queueRole]);
  const assigneeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assignees) map.set(a.id, a.name);
    return map;
  }, [assignees]);

  if (queueRole === "none") return null;

  const runAction = async (queueId: string, fn: () => Promise<void>) => {
    setSavingId(queueId);
    setError(null);
    try {
      await fn();
      await loadSnapshot(true);
      setNotice("Updated");
      window.setTimeout(() => setNotice(null), 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSavingId(null);
    }
  };

  const renderCard = (row: LeadQueueItem) => {
    const draft = drafts[row.id] ?? { baId: row.assigned_ba_id ?? "", laId: row.assigned_la_id ?? "", eta: row.eta_minutes != null ? String(row.eta_minutes) : "" };
    const isSaving = savingId === row.id;
    const showSendTransfer = queueRole === "ba" && row.queue_type === "ba_active" && !!row.la_ready_at;
    const hasAnyAssignment = Boolean(row.assigned_ba_id || row.assigned_la_id);
    const assignedBaName = row.assigned_ba_id
      ? assigneeNameById.get(row.assigned_ba_id) ?? "Assigned BA"
      : null;
    const assignedLaName = row.assigned_la_id
      ? assigneeNameById.get(row.assigned_la_id) ?? "Assigned LA"
      : null;

    return (
      <div
        key={row.id}
        style={{
          border: `1px solid ${hasAnyAssignment ? "#86b97b" : T.border}`,
          borderRadius: 10,
          background: hasAnyAssignment ? "#f6fbf4" : T.cardBg,
          padding: 8,
          display: "grid",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: T.textDark,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row.client_name || "Unnamed Client"}
            </div>
            {hasAnyAssignment && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: "#166534",
                  background: "#dcfce7",
                  border: "1px solid #86efac",
                  borderRadius: 999,
                  padding: "2px 6px",
                  flexShrink: 0,
                }}
              >
                ASSIGNED
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", flexShrink: 0 }}>{elapsedLabel(row.queued_at)}</div>
        </div>
        <div style={{ fontSize: 10, color: T.textMuted }}>
          {(row.call_center_name || "Unknown center")} | {row.state || "N/A"} | {row.carrier || "N/A"}
        </div>
        {(assignedBaName || assignedLaName) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {assignedBaName && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#0f172a",
                  background: "#e2e8f0",
                  borderRadius: 999,
                  padding: "2px 8px",
                }}
              >
                BA: {assignedBaName}
              </span>
            )}
            {assignedLaName && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#0f172a",
                  background: "#dbeafe",
                  borderRadius: 999,
                  padding: "2px 8px",
                }}
              >
                LA: {assignedLaName}
              </span>
            )}
          </div>
        )}
        <div style={{ fontSize: 10, color: T.textMuted }}>
          Action: <strong>{row.action_required || "unknown"}</strong>
          {row.queue_type === "ba_active" && row.ba_verification_percent != null
            ? ` | Verified ${Number(row.ba_verification_percent).toFixed(0)}%`
            : ""}
          {row.queue_type === "la_active" && row.ba_verification_percent != null
            ? ` | Verification: ${Number(row.ba_verification_percent).toFixed(0)}%`
            : ""}
          {row.queue_type === "la_active" && row.eta_minutes != null ? ` | ETA ${row.eta_minutes}m` : ""}
          {row.la_ready_at ? " | LA Ready" : ""}
        </div>

        {queueRole === "manager" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 72px auto", gap: 5 }}>
            <select
              value={draft.baId}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...draft, baId: e.target.value } }))}
              style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 6px", fontSize: 11 }}
            >
              <option value="">Assign BA</option>
              {assignees.filter((a) => a.queueRole === "ba").map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select
              value={draft.laId}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...draft, laId: e.target.value } }))}
              style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 6px", fontSize: 11 }}
            >
              <option value="">Assign LA</option>
              {assignees.filter((a) => a.queueRole === "la").map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="ETA"
              min={0}
              value={draft.eta}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...draft, eta: e.target.value } }))}
              style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 6px", fontSize: 11 }}
            />
            <button
              type="button"
              disabled={isSaving || !currentUserId}
              onClick={() =>
                runAction(row.id, async () =>
                  managerAssignQueueItem(supabase, row.id, String(currentUserId), {
                    assignedBaId: draft.baId || null,
                    assignedLaId: draft.laId || null,
                    etaMinutes: draft.eta ? Number(draft.eta) : null,
                  }),
                )
              }
              style={{
                border: "none",
                borderRadius: 8,
                background: "#233217",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                padding: "5px 8px",
                cursor: isSaving ? "not-allowed" : "pointer",
                opacity: isSaving ? 0.65 : 1,
              }}
            >
              Save
            </button>
          </div>
        )}

        {showSendTransfer && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={isSaving || !currentUserId}
              onClick={() => runAction(row.id, () => sendQueueTransfer(supabase, row, String(currentUserId)))}
              style={{
                border: "none",
                borderRadius: 8,
                background: "#0d9488",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                padding: "5px 8px",
                cursor: isSaving ? "not-allowed" : "pointer",
                opacity: isSaving ? 0.65 : 1,
              }}
            >
              Send Transfer
            </button>
          </div>
        )}
      </div>
    );
  };

  const section = (title: string, items: LeadQueueItem[]) => (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: T.textDark }}>
        {title} ({items.length})
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 11, color: T.textMuted, border: `1px dashed ${T.border}`, borderRadius: 10, padding: 8 }}>
          No calls
        </div>
      ) : (
        items.map(renderCard)
      )}
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          left: 16,
          bottom: 16,
          zIndex: 500,
          border: "none",
          borderRadius: 999,
          background: "#233217",
          color: "#fff",
          padding: "12px 14px",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontWeight: 800,
          cursor: "pointer",
          boxShadow: "0 12px 26px rgba(35, 50, 23, 0.35)",
        }}
      >
        <BellRing size={16} />
        Queue
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            left: 16,
            bottom: 70,
            zIndex: 500,
            width: "min(520px, calc(100vw - 32px))",
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "68vh",
            overflow: "auto",
            background: T.cardBg,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            boxShadow: T.shadowLg,
            padding: 10,
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "grid", gap: 2 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.textDark }}>Transfer Queue</div>
              <div style={{ fontSize: 10, color: T.textMuted }}>
                {lastUpdatedAt ? `Last sync ${new Date(lastUpdatedAt).toLocaleTimeString()}` : "Not synced yet"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => void loadSnapshot(true)}
                style={{
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  background: T.pageBg,
                  color: T.textDark,
                  cursor: "pointer",
                  padding: "5px 7px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                <RefreshCw size={13} className={refreshing ? "animate-spin" : undefined} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ border: "none", background: "transparent", color: T.textMuted, cursor: "pointer" }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 11, color: "#b91c1c", background: "#fef2f2", borderRadius: 8, padding: 8 }}>
              {error}
            </div>
          )}
          {notice && (
            <div style={{ fontSize: 11, color: "#166534", background: "#ecfdf5", borderRadius: 8, padding: 8 }}>
              {notice}
            </div>
          )}

          {loading && rows.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: T.textMuted }}>
              <Loader2 size={14} className="animate-spin" /> Loading queue...
            </div>
          ) : (
            <>
              {queueRole !== "manager" && section("Assigned To You (Next)", assignedToMe)}
              {section("Unclaimed Transfers", grouped.unclaimed)}
              {(queueRole === "manager" || queueRole === "la") && section("BA Active Calls", grouped.baActive)}
              {(queueRole === "manager" || queueRole === "ba") && section("LA Active Calls", grouped.laActive)}
            </>
          )}
        </div>
      )}
    </>
  );
}
