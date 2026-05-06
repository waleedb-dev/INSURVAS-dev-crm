"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search, ChevronDown } from "lucide-react";
import { T } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { TransferStyledSelect } from "./TransferStyledSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ELIGIBILITY_LANGUAGE,
  buildQueueLaEligibilityKey,
  normaliseUsState,
  requestQueueEligibleLaOptions,
  type LaMatchRow,
} from "@/lib/queue/eligibleLaAgents";
import {
  fetchQueueAssignees,
  fetchQueueSnapshot,
  managerAssignQueueItem,
  markQueueReady,
  notifyLaReadyForTransferIfNeeded,
  requestTransferScreeningBackfillForQueueRows,
  resolveQueueRole,
  sendQueueTransfer,
  type LeadQueueItem,
  type QueueAssignee,
} from "@/lib/queue/queueClient";
import {
  parsePersistedTransferScreening,
  transferScreeningBadgeChrome,
  transferScreeningBadgeMeta,
} from "@/lib/transferScreening";

type Props = {
  /** Embedded inside Live Monitoring: tighter paddings and no outer card chrome. */
  variant?: "default" | "liveMonitoringEmbed";
};

type DraftAssign = {
  baId: string;
  laId: string;
  eta: string;
};

/** Match `TransferStyledSelect` trigger height for one clean toolbar / assignment row */
const QUEUE_CONTROL_HEIGHT = 42;

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

function normalise(s: string | null | undefined): string {
  return String(s ?? "").trim().toLowerCase();
}

function matchesSearch(row: LeadQueueItem, q: string): boolean {
  const query = normalise(q);
  if (!query) return true;
  const hay = [
    row.client_name,
    row.submission_id,
    row.call_center_name,
    row.state,
    row.carrier,
    row.action_required,
    row.queue_type,
  ]
    .map((x) => normalise(String(x ?? "")))
    .join(" | ");
  return hay.includes(query);
}

export default function QueueManagementPage({ variant = "default" }: Props) {
  const { currentRole, currentUserId, userCallCenterId } = useDashboardContext();
  const queueRole = useMemo(() => resolveQueueRole(currentRole), [currentRole]);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const isEmbed = variant === "liveMonitoringEmbed";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [rows, setRows] = useState<LeadQueueItem[]>([]);
  const [assignees, setAssignees] = useState<QueueAssignee[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftAssign>>({});

  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const [eligibleCache, setEligibleCache] = useState<
    Record<
      string,
      {
        loading: boolean;
        loaded: boolean;
        error: string | null;
        unmatchedEligible: string[];
        options: Array<{ value: string; label: string }>;
      }
    >
  >({});

  const fetchEligibleAgents = useCallback(
    async (args: {
      carrier: string;
      state: string;
      leadVendor: string;
      language: "English" | "Spanish";
      licensedAgents: LaMatchRow[];
    }) => {
      const key = buildQueueLaEligibilityKey(args.carrier, args.state, args.leadVendor, args.language);
      const hit = eligibleCache[key];
      if (hit?.loading) return key;
      if (hit?.loaded) return key;

      setEligibleCache((prev) => ({
        ...prev,
        [key]: { loading: true, loaded: false, error: null, unmatchedEligible: [], options: [] },
      }));

      try {
        const { options, unmatchedEligible } = await requestQueueEligibleLaOptions({
          carrier: args.carrier,
          state: args.state,
          leadVendor: args.leadVendor,
          language: args.language,
          licensedAgents: args.licensedAgents,
        });

        setEligibleCache((prev) => ({
          ...prev,
          [key]: {
            loading: false,
            loaded: true,
            error: null,
            unmatchedEligible,
            options,
          },
        }));
      } catch (e) {
        setEligibleCache((prev) => ({
          ...prev,
          [key]: {
            loading: false,
            loaded: true,
            error: e instanceof Error ? e.message : "Failed to load eligible agents",
            unmatchedEligible: [],
            options: [{ value: "__unassigned__", label: "Unassigned" }],
          },
        }));
      }

      return key;
    },
    [eligibleCache],
  );

  const loadSnapshot = useCallback(
    async (silent = false) => {
      if (queueRole === "none") {
        setRows([]);
        setAssignees([]);
        setLoading(false);
        return;
      }
      if (silent) setRefreshing(true);
      else setLoading(true);
      if (!silent) setError(null);
      try {
        const [queueRows, agents] = await Promise.all([
          fetchQueueSnapshot(supabase, queueRole, currentUserId, { callCenterId: userCallCenterId }),
          queueRole === "manager" ? fetchQueueAssignees(supabase) : Promise.resolve([]),
        ]);
        setRows(queueRows);
        setAssignees(agents);
        requestTransferScreeningBackfillForQueueRows(supabase, queueRows);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load queue");
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [queueRole, supabase, currentUserId, userCallCenterId],
  );

  useEffect(() => {
    void loadSnapshot(false);
    const timer = window.setInterval(() => {
      void loadSnapshot(true);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadSnapshot]);

  const licensedAgentsFingerprint = useMemo(
    () =>
      assignees
        .filter((a) => a.queueRole === "la")
        .map((a) => `${a.id}\0${a.name}`)
        .sort()
        .join("|"),
    [assignees],
  );

  useEffect(() => {
    if (queueRole !== "manager") return;
    setEligibleCache({});
  }, [licensedAgentsFingerprint, queueRole]);

  const assigneeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assignees) map.set(a.id, a.name);
    return map;
  }, [assignees]);

  const baAssigneeOptions = useMemo(() => {
    const opts = assignees
      .filter((a) => a.queueRole === "ba")
      .map((a) => ({ value: a.id, label: a.name }));
    return [{ value: "__unassigned__", label: "Unassigned" }, ...opts];
  }, [assignees]);

  const filteredRows = useMemo(
    () => rows.filter((r) => matchesSearch(r, searchTerm)),
    [rows, searchTerm],
  );

  const grouped = useMemo(() => {
    if (queueRole === "manager") {
      return [
        { key: "unclaimed_transfer", title: "Unclaimed transfers", items: filteredRows.filter((r) => r.queue_type === "unclaimed_transfer") },
        { key: "ba_active", title: "BA active calls", items: filteredRows.filter((r) => r.queue_type === "ba_active") },
        { key: "la_active", title: "LA active calls", items: filteredRows.filter((r) => r.queue_type === "la_active") },
      ];
    }
    if (queueRole === "la") {
      return [
        { key: "unclaimed_transfer", title: "Unclaimed transfers", items: filteredRows.filter((r) => r.queue_type === "unclaimed_transfer") },
        { key: "ba_active", title: "BA active calls", items: filteredRows.filter((r) => r.queue_type === "ba_active") },
      ];
    }
    if (queueRole === "ba") {
      return [
        { key: "unclaimed_transfer", title: "Unclaimed transfers", items: filteredRows.filter((r) => r.queue_type === "unclaimed_transfer") },
        { key: "ba_active", title: "BA active calls", items: filteredRows.filter((r) => r.queue_type === "ba_active") },
      ];
    }
    if (queueRole === "call_center_agent" || queueRole === "call_center_admin") {
      return [
        { key: "unclaimed_transfer", title: "Unclaimed transfers", items: filteredRows.filter((r) => r.queue_type === "unclaimed_transfer") },
        { key: "ba_active", title: "BA active calls", items: filteredRows.filter((r) => r.queue_type === "ba_active") },
        { key: "la_active", title: "LA active calls", items: filteredRows.filter((r) => r.queue_type === "la_active") },
      ];
    }
    return [];
  }, [filteredRows, queueRole]);

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

  const runManagerAssign = async (row: LeadQueueItem, draft: DraftAssign) => {
    if (!currentUserId) return;
    await runAction(row.id, () =>
      managerAssignQueueItem(supabase, row.id, String(currentUserId), {
        assignedBaId: draft.baId || null,
        assignedLaId: draft.laId || null,
        etaMinutes: draft.eta ? Number(draft.eta) : null,
      }),
    );
  };

  const renderCard = (row: LeadQueueItem) => {
    const draft = drafts[row.id] ?? {
      baId: row.assigned_ba_id ?? "",
      laId: row.assigned_la_id ?? "",
      eta: row.eta_minutes != null ? String(row.eta_minutes) : "",
    };
    const isSaving = savingId === row.id;
    const hasAnyAssignment = Boolean(row.assigned_ba_id || row.assigned_la_id);

    const assignedBaName = row.assigned_ba_id ? assigneeNameById.get(row.assigned_ba_id) ?? "Assigned BA" : null;
    const assignedLaName = row.assigned_la_id ? assigneeNameById.get(row.assigned_la_id) ?? "Assigned LA" : null;

    const showSendTransfer = queueRole === "ba" && row.queue_type === "ba_active" && !!row.la_ready_at;
    const showReady =
      (queueRole === "ba" && (row.queue_type === "unclaimed_transfer" || row.queue_type === "ba_active")) ||
      (queueRole === "la" && (row.queue_type === "unclaimed_transfer" || row.queue_type === "ba_active"));
    const readyLabel =
      row.queue_type === "unclaimed_transfer"
        ? "CLAIM"
        : queueRole === "la"
          ? "LA READY"
          : "MARK READY";

    const carrierForEligibility = String(row.carrier ?? "").trim();
    const stateForEligibility = normaliseUsState(row.state);
    const vendorForEligibility = String(row.call_center_name ?? "").trim();
    const eligibilityKey =
      carrierForEligibility && stateForEligibility && vendorForEligibility
        ? buildQueueLaEligibilityKey(carrierForEligibility, stateForEligibility, vendorForEligibility, ELIGIBILITY_LANGUAGE)
        : null;
    const eligibleState = eligibilityKey ? eligibleCache[eligibilityKey] : null;
    const laOptionsFromCache =
      eligibilityKey && eligibleState?.loaded ? eligibleState.options : [];
    const laOptionsForRow = (() => {
      let opts = laOptionsFromCache;
      const ensureOptionForId = (rawId: string | null | undefined) => {
        const id = rawId?.trim();
        if (!id || opts.some((o) => o.value === id)) return;
        const name =
          assignees.find((a) => a.id === id)?.name ??
          assigneeNameById.get(id) ??
          "Current assignee";
        const head = opts[0];
        const tail = opts.slice(1);
        opts = head ? [head, { value: id, label: name }, ...tail] : opts;
      };
      ensureOptionForId(row.assigned_la_id);
      ensureOptionForId(drafts[row.id]?.laId);
      return opts;
    })();

    const laSelectDisplayLabel = (() => {
      const id = draft.laId?.trim();
      if (!id) return null;
      return (
        laOptionsForRow.find((o) => o.value === id)?.label ??
        assignees.find((a) => a.id === id)?.name ??
        assigneeNameById.get(id) ??
        "Licensed agent"
      );
    })();

    const ensureEligibleLoaded = async () => {
      if (!eligibilityKey) return;
      if (eligibleCache[eligibilityKey]?.loaded) return;
      await fetchEligibleAgents({
        carrier: carrierForEligibility,
        state: stateForEligibility,
        leadVendor: vendorForEligibility,
        language: ELIGIBILITY_LANGUAGE,
        licensedAgents: assignees.filter((a) => a.queueRole === "la"),
      });
    };

    const screeningPersisted = parsePersistedTransferScreening(row.transfer_screening_json);
    const screeningMeta = screeningPersisted ? transferScreeningBadgeMeta(screeningPersisted) : null;
    const screeningChrome = screeningMeta ? transferScreeningBadgeChrome(screeningMeta.tone) : null;
    const isCardExpanded = expandedCards.has(row.id);

    return (
      <div
        key={row.id}
        style={{
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          background: "#ffffff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          transition: "all 0.15s ease-in-out",
          overflow: "hidden",
        }}
        className="hover:shadow-sm hover:border-[#86b97b]"
      >
        <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flexWrap: "wrap" }}>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  backgroundColor: hasAnyAssignment ? "#22c55e" : "#f59e0b",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: T.textDark,
                  letterSpacing: "-0.01em",
                }}
              >
                {row.client_name || "Unnamed client"}
              </span>
              {hasAnyAssignment && (
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
                    color: "#166534",
                    background: "#dcfce7",
                    borderRadius: 999,
                    padding: "2px 6px",
                    flexShrink: 0,
                    letterSpacing: "0.03em",
                    textTransform: "uppercase",
                  }}
                >
                  ASSIGNED
                </span>
              )}
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  color: "#647864",
                  background: "#e8efdf",
                  borderRadius: 999,
                  padding: "2px 6px",
                  flexShrink: 0,
                }}
              >
                {elapsedLabel(row.queued_at)}
              </span>
              {row.ba_verification_percent != null && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
                  <div style={{ height: 4, width: 40, background: "#e8efdf", borderRadius: 2, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${row.ba_verification_percent}%`,
                        background: Number(row.ba_verification_percent) >= 80 ? "#22c55e" : Number(row.ba_verification_percent) >= 50 ? "#f59e0b" : "#ef4444",
                        borderRadius: 2,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 8, fontWeight: 700, color: T.textMuted }}>{Number(row.ba_verification_percent).toFixed(0)}%</span>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setExpandedCards(prev => {
                  const next = new Set(prev);
                  if (next.has(row.id)) {
                    next.delete(row.id);
                  } else {
                    next.add(row.id);
                  }
                  return next;
                });
              }}
              style={{
                background: "none",
                border: "none",
                padding: 2,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                color: T.textMuted,
                transition: "transform 0.15s ease-in-out",
                transform: isCardExpanded ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              <ChevronDown size={14} />
            </button>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{
              background: "#fef3c7",
              padding: "3px 8px",
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 10,
              color: "#92400e",
              border: "1px solid #fcd34d"
            }}>{row.carrier || "N/A"}</span>
            <span style={{
              background: "#fef3c7",
              padding: "3px 8px",
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 10,
              color: "#92400e",
              border: "1px solid #fcd34d"
            }}>{row.state || "N/A"}</span>
            <span style={{
              background: "#fef3c7",
              padding: "3px 8px",
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 10,
              color: "#92400e",
              border: "1px solid #fcd34d"
            }}>{row.call_center_name || "Unknown"}</span>
            {assignedBaName && (
              <span style={{
                background: "#dbeafe",
                padding: "3px 8px",
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 10,
                color: "#1e40af",
                border: "1px solid #93c5fd"
              }}>
                BA: {assignedBaName}
              </span>
            )}
            {assignedLaName && (
              <span style={{
                background: "#ccfbf1",
                padding: "3px 8px",
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 10,
                color: "#115e59",
                border: "1px solid #5eead4"
              }}>
                LA: {assignedLaName}
              </span>
            )}
          </div>
        </div>

        {isCardExpanded && (
          <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
            {screeningMeta && screeningChrome && (
              <div
                style={{
                  fontFamily: T.font,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  background: "#fafafa",
                }}
                role="status"
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    fontWeight: 500,
                    color: T.textMid,
                    lineHeight: 1.5,
                    wordBreak: "break-word",
                  }}
                >
                  {screeningMeta.message}
                </p>
              </div>
            )}

            {(queueRole === "ba" || queueRole === "la") && (showReady || showSendTransfer) && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "center",
                  paddingTop: 6,
                  borderTop: `1px solid ${T.borderLight}`,
                }}
              >
                {showReady && (
                  <button
                    type="button"
                    disabled={isSaving || !currentUserId}
                    onClick={() =>
                      void runAction(row.id, async () => {
                        if (!currentUserId) return;
                        const before = row;
                        await markQueueReady(supabase, row, String(currentUserId), queueRole);
                        await notifyLaReadyForTransferIfNeeded(supabase, {
                          queueItemBefore: before,
                          actorUserId: String(currentUserId),
                          actorRole: queueRole,
                        });
                      })
                    }
                    style={{
                      border: "none",
                      borderRadius: 10,
                      background: row.queue_type === "unclaimed_transfer" ? "#f59e0b" : "#233217",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 900,
                      height: 34,
                      padding: "0 14px",
                      cursor: isSaving ? "not-allowed" : "pointer",
                      opacity: isSaving ? 0.65 : 1,
                      flexShrink: 0,
                      boxSizing: "border-box",
                      fontFamily: T.font,
                      letterSpacing: "0.04em",
                    }}
                    className="transition-all duration-150 ease-in-out hover:brightness-110 active:scale-[0.98]"
                  >
                    {readyLabel}
                  </button>
                )}

                {showSendTransfer && (
                  <button
                    type="button"
                    disabled={isSaving || !currentUserId || !row.assigned_la_id}
                    onClick={() =>
                      void runAction(row.id, async () => {
                        if (!currentUserId) return;
                        await sendQueueTransfer(supabase, row, String(currentUserId));
                      })
                    }
                    style={{
                      border: "none",
                      borderRadius: 10,
                      background: "#2563eb",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 900,
                      height: 34,
                      padding: "0 14px",
                      cursor: isSaving ? "not-allowed" : "pointer",
                      opacity: isSaving ? 0.65 : 1,
                      flexShrink: 0,
                      boxSizing: "border-box",
                      fontFamily: T.font,
                      letterSpacing: "0.04em",
                    }}
                    className="transition-all duration-150 ease-in-out hover:brightness-110 active:scale-[0.98]"
                    title={!row.assigned_la_id ? "Assign an LA first" : undefined}
                  >
                    SEND TRANSFER
                  </button>
                )}
              </div>
            )}

            {queueRole === "manager" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) 60px auto",
                  gap: 6,
                  alignItems: "stretch",
                  paddingTop: 6,
                  borderTop: `1px solid ${T.borderLight}`,
                }}
              >
                <div style={{ minWidth: 0, width: "100%", display: "flex", alignItems: "stretch" }}>
                  <TransferStyledSelect
                    value={draft.baId || "__unassigned__"}
                    onValueChange={(val) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.id]: { ...draft, baId: val === "__unassigned__" ? "" : val },
                      }))
                    }
                    options={baAssigneeOptions}
                    placeholder="BA"
                    compact
                  />
                </div>
                <div style={{ minWidth: 0, width: "100%", display: "flex", alignItems: "stretch" }}>
                  <Select
                    value={draft.laId ? draft.laId : undefined}
                    onValueChange={(val) => {
                      const next = val ?? "";
                      setDrafts((prev) => ({
                        ...prev,
                        [row.id]: { ...draft, laId: next === "__unassigned__" ? "" : next },
                      }));
                    }}
                    onOpenChange={(open) => {
                      if (!open) return;
                      void ensureEligibleLoaded();
                    }}
                  >
                    <SelectTrigger
                      style={{
                        width: "100%",
                        height: 32,
                        borderRadius: 8,
                        border: `1px solid ${T.borderLight}`,
                        backgroundColor: "#fff",
                        color: draft.laId ? T.textDark : T.textMuted,
                        fontSize: 12,
                        fontWeight: 600,
                        paddingLeft: 10,
                        paddingRight: 8,
                        transition: "all 0.15s ease-in-out",
                        opacity: !eligibilityKey ? 0.7 : 1,
                        boxSizing: "border-box",
                      }}
                      className="hover:border-[#638b4b] focus:border-[#638b4b] focus:ring-1 focus:ring-[#638b4b]/20"
                      title={!eligibilityKey ? "Needs carrier, state and centre" : undefined}
                    >
                      <SelectValue placeholder="LA">{laSelectDisplayLabel ?? undefined}</SelectValue>
                    </SelectTrigger>
                    <SelectContent
                      style={{
                        borderRadius: 10,
                        border: `1px solid ${T.border}`,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        backgroundColor: "#fff",
                        padding: 4,
                        maxHeight: 200,
                        zIndex: 99999,
                      }}
                    >
                      {eligibleState?.loading && (
                        <div style={{ padding: "6px 8px", fontSize: 11, fontWeight: 600, color: T.textMuted }}>
                          Loading...
                        </div>
                      )}
                      {eligibleState?.error && (
                        <div style={{ padding: "6px 8px", fontSize: 11, fontWeight: 600, color: "#b91c1c" }}>
                          {eligibleState.error}
                        </div>
                      )}
                      {laOptionsForRow.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          style={{
                            borderRadius: 6,
                            padding: "6px 10px",
                            fontSize: 12,
                            fontWeight: 400,
                            color: T.textDark,
                            cursor: "pointer",
                          }}
                          className="hover:bg-[#f2f8ee] focus:bg-[#f2f8ee]"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <input
                  type="number"
                  placeholder="ETA"
                  min={0}
                  value={draft.eta}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...draft, eta: e.target.value } }))}
                  style={{
                    width: "100%",
                    height: 32,
                    boxSizing: "border-box",
                    border: `1px solid ${T.borderLight}`,
                    borderRadius: 8,
                    padding: "0 8px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: T.textDark,
                    background: "#fff",
                    outline: "none",
                    fontFamily: T.font,
                  }}
                  className="hover:border-[#638b4b] focus:border-[#638b4b] focus:ring-1 focus:ring-[#638b4b]/20"
                />
                <button
                  type="button"
                  disabled={isSaving || !currentUserId}
                  onClick={() => void runManagerAssign(row, draft)}
                  style={{
                    border: "none",
                    borderRadius: 8,
                    background: "#233217",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    height: 32,
                    padding: "0 10px",
                    cursor: isSaving ? "not-allowed" : "pointer",
                    opacity: isSaving ? 0.65 : 1,
                    flexShrink: 0,
                    boxSizing: "border-box",
                  }}
                  className="hover:bg-[#3b5229] active:scale-[0.98]"
                >
                  Save
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (queueRole === "none") {
    return (
      <div
        style={{
          border: `1px dashed ${T.border}`,
          borderRadius: 16,
          padding: 16,
          background: isEmbed ? "transparent" : T.cardBg,
          color: T.textMuted,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Queue management is not available for your role.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          alignItems: "center",
          gap: 12,
          padding: isEmbed ? 0 : "12px 14px",
          borderRadius: isEmbed ? 0 : 16,
          border: isEmbed ? "none" : `1px solid ${T.border}`,
          background: isEmbed ? "transparent" : T.cardBg,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
        >
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              minWidth: 200,
              flex: "1 1 220px",
            }}
          >
            <Search size={16} style={{ position: "absolute", left: 14, pointerEvents: "none", color: T.textMuted }} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search leads, carriers, states..."
              style={{
                height: QUEUE_CONTROL_HEIGHT,
                width: "100%",
                boxSizing: "border-box",
                paddingLeft: 40,
                paddingRight: 12,
                border: `1.5px solid ${T.border}`,
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                color: T.textDark,
                background: "#fff",
                outline: "none",
                fontFamily: T.font,
                transition: "all 0.15s ease-in-out",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
              className="hover:border-[#638b4b] focus:border-[#638b4b] focus:ring-2 focus:ring-[#638b4b]/20"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadSnapshot(true)}
          style={{
            height: QUEUE_CONTROL_HEIGHT,
            minHeight: QUEUE_CONTROL_HEIGHT,
            padding: "0 20px",
            borderRadius: 10,
            border: "none",
            background: "linear-gradient(135deg, #233217 0%, #3b5229 100%)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 4px 12px rgba(35, 50, 23, 0.25)",
            flexShrink: 0,
            boxSizing: "border-box",
            transition: "all 0.15s ease-in-out",
          }}
          className="hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
          title="Refresh queue"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : undefined} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c", background: "#fef2f2", borderRadius: 12, padding: 10, border: "1px solid #fecaca" }}>
          {error}
        </div>
      )}
      {notice && (
        <div style={{ fontSize: 12, fontWeight: 800, color: "#166534", background: "#ecfdf5", borderRadius: 12, padding: 10, border: "1px solid #bbf7d0" }}>
          {notice}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700, color: T.textMuted, padding: "10px 2px" }}>
          <Loader2 size={16} className="animate-spin" /> Loading queue...
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 12,
            alignContent: "start",
          }}
        >
          {grouped.map((section) => (
            <div key={section.key} style={{ display: "grid", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 10,
                  ...(() => {
                    switch (section.key) {
                      case "unclaimed_transfer":
                        return {
                          background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                          borderLeft: "3px solid #f59e0b",
                        };
                      case "ba_active":
                        return {
                          background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
                          borderLeft: "3px solid #3b82f6",
                        };
                      case "la_active":
                        return {
                          background: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
                          borderLeft: "3px solid #10b981",
                        };
                      default:
                        return {
                          background: "#e8efdf",
                          borderLeft: "3px solid #638b4b",
                        };
                    }
                  })(),
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    ...(() => {
                      switch (section.key) {
                        case "unclaimed_transfer":
                          return { color: "#92400e" };
                        case "ba_active":
                          return { color: "#1e40af" };
                        case "la_active":
                          return { color: "#065f46" };
                        default:
                          return { color: "#3b5229" };
                      }
                    })(),
                  }}
                >
                  {section.title}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: "2px 8px",
                    ...(() => {
                      switch (section.key) {
                        case "unclaimed_transfer":
                          return { color: "#92400e", background: "#fffbeb" };
                        case "ba_active":
                          return { color: "#1e40af", background: "#eff6ff" };
                        case "la_active":
                          return { color: "#065f46", background: "#ecfdf5" };
                        default:
                          return { color: "#647864", background: "#fff" };
                      }
                    })(),
                  }}
                >
                  {section.items.length}
                </span>
              </div>
              {section.items.length === 0 ? (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: T.textMuted,
                    border: `1px dashed ${T.border}`,
                    borderRadius: 12,
                    padding: "16px 12px",
                    textAlign: "center",
                    background: "#fafafa",
                  }}
                >
                  No calls in this queue
                </div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {section.items.map(renderCard)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

