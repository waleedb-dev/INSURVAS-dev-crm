"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, Loader2, RefreshCw, X } from "lucide-react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { TransferStyledSelect } from "@/components/dashboard/pages/TransferStyledSelect";
import TransferCheckGateModal from "@/components/dashboard/TransferCheckGateModal";
import {
  fetchQueueAssignees,
  fetchQueueSnapshot,
  managerAssignQueueItem,
  resolveQueueRole,
  sendQueueTransfer,
  type LeadQueueItem,
} from "@/lib/queue/queueClient";
import {
  IDLE_TRANSFER_SCREENING,
  runTransferScreeningForPhone,
  type TransferScreeningSnapshot,
} from "@/lib/transferScreening";
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

/** Match `TransferStyledSelect` trigger height for one aligned manager row */
const WIDGET_CONTROL_HEIGHT = 42;

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
  const [transferCheckModalOpen, setTransferCheckModalOpen] = useState(false);
  const [transferCheckModalLoading, setTransferCheckModalLoading] = useState(false);
  const [transferCheckModalClient, setTransferCheckModalClient] = useState("");
  const [transferCheckModalSnapshot, setTransferCheckModalSnapshot] =
    useState<TransferScreeningSnapshot>(IDLE_TRANSFER_SCREENING);

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

  const baAssigneeOptions = useMemo(() => {
    const opts = assignees
      .filter((a) => a.queueRole === "ba")
      .map((a) => ({ value: a.id, label: a.name }));
    return [{ value: "__unassigned__", label: "Assign BA" }, ...opts];
  }, [assignees]);

  const laAssigneeOptions = useMemo(() => {
    const opts = assignees
      .filter((a) => a.queueRole === "la")
      .map((a) => ({ value: a.id, label: a.name }));
    return [{ value: "__unassigned__", label: "Assign LA" }, ...opts];
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

  const runManagerAssignWithTransferCheck = async (row: LeadQueueItem, draft: DraftAssign) => {
    if (!currentUserId) return;
    setSavingId(row.id);
    setError(null);
    try {
      await managerAssignQueueItem(supabase, row.id, String(currentUserId), {
        assignedBaId: draft.baId || null,
        assignedLaId: draft.laId || null,
        etaMinutes: draft.eta ? Number(draft.eta) : null,
      });
      await loadSnapshot(true);
      setNotice("Updated");
      window.setTimeout(() => setNotice(null), 1400);
      setTransferCheckModalClient(row.client_name ?? "");
      setTransferCheckModalSnapshot(IDLE_TRANSFER_SCREENING);
      setTransferCheckModalLoading(true);
      setTransferCheckModalOpen(true);
      const snap = await runTransferScreeningForPhone(supabase, row.phone_number);
      setTransferCheckModalSnapshot(snap);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
      setTransferCheckModalOpen(false);
    } finally {
      setTransferCheckModalLoading(false);
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
          borderRadius: 12,
          background: hasAnyAssignment ? "#f6fbf4" : "#fff",
          padding: 12,
          display: "grid",
          gap: 10,
          boxShadow: "0 1px 2px rgba(35, 50, 23, 0.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                color: T.textDark,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={row.client_name || "Unnamed client"}
            >
              {row.client_name || "Unnamed client"}
            </div>
            {hasAnyAssignment && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  color: "#166534",
                  background: "#dcfce7",
                  border: "1px solid #86efac",
                  borderRadius: 999,
                  padding: "3px 8px",
                  flexShrink: 0,
                  letterSpacing: "0.06em",
                }}
              >
                ASSIGNED
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: T.textMuted,
              flexShrink: 0,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {elapsedLabel(row.queued_at)}
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, lineHeight: 1.45 }}>
          {(row.call_center_name || "Unknown centre")} | {row.state || "N/A"} | {row.carrier || "N/A"}
        </div>
        {(assignedBaName || assignedLaName) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {assignedBaName && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: "#0f172a",
                  background: "#e2e8f0",
                  borderRadius: 999,
                  padding: "4px 10px",
                }}
              >
                BA: {assignedBaName}
              </span>
            )}
            {assignedLaName && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: "#0f172a",
                  background: "#dbeafe",
                  borderRadius: 999,
                  padding: "4px 10px",
                }}
              >
                LA: {assignedLaName}
              </span>
            )}
          </div>
        )}
        <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, lineHeight: 1.5 }}>
          Action:{" "}
          <strong style={{ color: T.textDark, fontWeight: 800 }}>{row.action_required || "unknown"}</strong>
          {row.queue_type === "ba_active" && row.ba_verification_percent != null
            ? ` · Verification ${Number(row.ba_verification_percent).toFixed(0)}%`
            : ""}
          {row.queue_type === "la_active" && row.ba_verification_percent != null
            ? ` · Verification ${Number(row.ba_verification_percent).toFixed(0)}%`
            : ""}
          {row.queue_type === "la_active" && row.eta_minutes != null ? ` · ETA ${row.eta_minutes}m` : ""}
          {row.la_ready_at ? " · LA ready" : ""}
        </div>

        {queueRole === "manager" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) 76px minmax(min-content, auto)",
              gap: 8,
              alignItems: "stretch",
              paddingTop: 2,
            }}
          >
            <div style={{ minWidth: 0, width: "100%", display: "flex", alignItems: "stretch" }}>
              <TransferStyledSelect
                value={draft.baId ? draft.baId : "__unassigned__"}
                onValueChange={(val) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [row.id]: { ...draft, baId: val === "__unassigned__" ? "" : val },
                  }))
                }
                options={baAssigneeOptions}
                placeholder="Assign BA"
              />
            </div>
            <div style={{ minWidth: 0, width: "100%", display: "flex", alignItems: "stretch" }}>
              <TransferStyledSelect
                value={draft.laId ? draft.laId : "__unassigned__"}
                onValueChange={(val) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [row.id]: { ...draft, laId: val === "__unassigned__" ? "" : val },
                  }))
                }
                options={laAssigneeOptions}
                placeholder="Assign LA"
              />
            </div>
            <input
              type="number"
              placeholder="ETA"
              min={0}
              value={draft.eta}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...draft, eta: e.target.value } }))}
              style={{
                width: "100%",
                height: WIDGET_CONTROL_HEIGHT,
                minHeight: WIDGET_CONTROL_HEIGHT,
                boxSizing: "border-box",
                border: `1.5px solid ${T.border}`,
                borderRadius: 10,
                padding: "0 10px",
                fontSize: 13,
                fontWeight: 600,
                color: T.textDark,
                background: "#fff",
                outline: "none",
                fontFamily: T.font,
              }}
              className="hover:border-[#233217] focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
            />
            <button
              type="button"
              disabled={isSaving || !currentUserId}
              onClick={() => void runManagerAssignWithTransferCheck(row, draft)}
              style={{
                border: "none",
                borderRadius: 10,
                background: "#233217",
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                height: WIDGET_CONTROL_HEIGHT,
                minHeight: WIDGET_CONTROL_HEIGHT,
                padding: "0 16px",
                cursor: isSaving ? "not-allowed" : "pointer",
                opacity: isSaving ? 0.65 : 1,
                boxShadow: "0 4px 12px rgba(35, 50, 23, 0.15)",
                flexShrink: 0,
                boxSizing: "border-box",
              }}
            >
              Save
            </button>
          </div>
        )}

        {showSendTransfer && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={isSaving || !currentUserId}
              onClick={() => runAction(row.id, () => sendQueueTransfer(supabase, row, String(currentUserId)))}
              style={{
                border: "none",
                borderRadius: 10,
                background: "#0d9488",
                color: "#fff",
                fontSize: 12,
                fontWeight: 900,
                padding: "10px 14px",
                cursor: isSaving ? "not-allowed" : "pointer",
                opacity: isSaving ? 0.65 : 1,
                boxShadow: "0 4px 12px rgba(13, 148, 136, 0.25)",
              }}
            >
              Send transfer
            </button>
          </div>
        )}
      </div>
    );
  };

  const section = (title: string, items: LeadQueueItem[]) => (
    <div style={{ display: "grid", gap: 10 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: T.textMuted,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {title}{" "}
        <span style={{ color: T.textDark }}>({items.length})</span>
      </div>
      {items.length === 0 ? (
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: T.textMuted,
            border: `1px dashed ${T.border}`,
            borderRadius: 12,
            padding: 14,
            textAlign: "center",
            background: "#fafcf8",
          }}
        >
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
            zIndex: 550,
            width: "min(560px, calc(100vw - 32px))",
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "72vh",
            display: "flex",
            flexDirection: "column",
            background: "#fafcf8",
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            boxShadow: "0 16px 40px rgba(35, 50, 23, 0.12), 0 0 1px rgba(35, 50, 23, 0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              background: "#fff",
              borderBottom: `1px solid ${T.border}`,
            }}
          >
            <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: T.textDark, letterSpacing: "-0.02em" }}>
                Transfer queue
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>
                {lastUpdatedAt ? `Last sync ${new Date(lastUpdatedAt).toLocaleTimeString()}` : "Not synced yet"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => void loadSnapshot(true)}
                style={{
                  height: 36,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  background: "#233217",
                  color: "#fff",
                  cursor: "pointer",
                  padding: "0 12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 800,
                  fontFamily: T.font,
                  boxShadow: "0 4px 12px rgba(35, 50, 23, 0.18)",
                }}
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : undefined} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Close"
                style={{
                  width: 36,
                  height: 36,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  background: "#fff",
                  color: T.textMuted,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                className="hover:text-[#233217] hover:border-[#233217]"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              padding: "14px 16px 16px",
              display: "grid",
              gap: 14,
            }}
          >
            {error && (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#b91c1c",
                  background: "#fef2f2",
                  borderRadius: 12,
                  padding: 10,
                  border: "1px solid #fecaca",
                }}
              >
                {error}
              </div>
            )}
            {notice && (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#166534",
                  background: "#ecfdf5",
                  borderRadius: 12,
                  padding: 10,
                  border: "1px solid #bbf7d0",
                }}
              >
                {notice}
              </div>
            )}

            {loading && rows.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700, color: T.textMuted }}>
                <Loader2 size={16} className="animate-spin" /> Loading queue…
              </div>
            ) : (
              <>
                {queueRole !== "manager" && section("Assigned to you (next)", assignedToMe)}
                {section("Unclaimed transfers", grouped.unclaimed)}
                {(queueRole === "manager" || queueRole === "la") && section("BA active calls", grouped.baActive)}
                {(queueRole === "manager" || queueRole === "ba") && section("LA active calls", grouped.laActive)}
              </>
            )}
          </div>
        </div>
      )}

      <TransferCheckGateModal
        open={transferCheckModalOpen}
        loading={transferCheckModalLoading}
        clientName={transferCheckModalClient}
        snapshot={transferCheckModalSnapshot}
        onDismiss={() => {
          setTransferCheckModalOpen(false);
          setTransferCheckModalSnapshot(IDLE_TRANSFER_SCREENING);
        }}
      />
    </>
  );
}
