"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { T } from "@/lib/theme";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { TransferStyledSelect } from "./TransferStyledSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TransferCheckGateModal from "@/components/dashboard/TransferCheckGateModal";
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
  resolveQueueRole,
  sendQueueTransfer,
  type LeadQueueItem,
  type QueueAssignee,
} from "@/lib/queue/queueClient";
import {
  IDLE_TRANSFER_SCREENING,
  parsePersistedTransferScreening,
  runTransferScreeningForPhone,
  transferScreeningBadgeChrome,
  transferScreeningBadgeMeta,
  type TransferScreeningSnapshot,
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

  const [transferCheckModalOpen, setTransferCheckModalOpen] = useState(false);
  const [transferCheckModalLoading, setTransferCheckModalLoading] = useState(false);
  const [transferCheckModalClient, setTransferCheckModalClient] = useState("");
  const [transferCheckModalSnapshot, setTransferCheckModalSnapshot] =
    useState<TransferScreeningSnapshot>(IDLE_TRANSFER_SCREENING);

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
        { key: "la_active", title: "LA active calls", items: filteredRows.filter((r) => r.queue_type === "la_active") },
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

    return (
      <div
        key={row.id}
        style={{
          border: `1px solid ${hasAnyAssignment ? "#86b97b" : T.border}`,
          borderRadius: 12,
          background: hasAnyAssignment ? "#f6fbf4" : T.cardBg,
          padding: 12,
          display: "grid",
          gap: 10,
          transition: "all 0.15s ease-in-out",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
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
                  padding: "2px 8px",
                  flexShrink: 0,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                Assigned
              </span>
            )}
            {(() => {
              const persisted = parsePersistedTransferScreening(row.transfer_screening_json);
              if (!persisted) return null;
              const { shortLabel, message, tone } = transferScreeningBadgeMeta(persisted);
              const chrome = transferScreeningBadgeChrome(tone);
              return (
                <span
                  title={message}
                  style={{
                    fontSize: 9,
                    fontWeight: 900,
                    color: chrome.color,
                    background: chrome.background,
                    border: chrome.border,
                    borderRadius: 999,
                    padding: "2px 8px",
                    flexShrink: 0,
                    letterSpacing: "0.04em",
                  }}
                >
                  {shortLabel}
                </span>
              );
            })()}
          </div>
          <div style={{ fontSize: 10, fontWeight: 800, color: T.textMuted, flexShrink: 0 }}>
            {elapsedLabel(row.queued_at)}
          </div>
        </div>

        <div style={{ fontSize: 11, color: T.textMuted }}>
          {(row.call_center_name || "Unknown centre")} | {row.state || "N/A"} | {row.carrier || "N/A"}
        </div>

        {(assignedBaName || assignedLaName) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {assignedBaName && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: "#0f172a",
                  background: "#e2e8f0",
                  borderRadius: 999,
                  padding: "2px 10px",
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
                  padding: "2px 10px",
                }}
              >
                LA: {assignedLaName}
              </span>
            )}
          </div>
        )}

        {(() => {
          const bits: string[] = [];
          if (row.ba_verification_percent != null) {
            bits.push(`Verification ${Number(row.ba_verification_percent).toFixed(0)}%`);
          }
          if (row.eta_minutes != null) bits.push(`ETA ${row.eta_minutes}m`);
          if (row.la_ready_at) bits.push("LA ready");
          if (bits.length === 0) return null;
          return (
            <div style={{ fontSize: 11, color: T.textMuted }}>{bits.join(" · ")}</div>
          );
        })()}

        {queueRole === "manager" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) 92px minmax(min-content, auto)",
              gap: 8,
              alignItems: "stretch",
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
                placeholder="Assign BA"
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
                  height: QUEUE_CONTROL_HEIGHT,
                  minHeight: QUEUE_CONTROL_HEIGHT,
                  borderRadius: 10,
                  border: `1.5px solid ${T.border}`,
                  backgroundColor: "#fff",
                  color: draft.laId ? T.textDark : T.textMuted,
                  fontSize: 14,
                  fontWeight: 600,
                  paddingLeft: 14,
                  paddingRight: 12,
                  transition: "all 0.15s ease-in-out",
                  opacity: !eligibilityKey ? 0.7 : 1,
                  boxSizing: "border-box",
                }}
                className="hover:border-[#233217] focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
                title={!eligibilityKey ? "Needs carrier, state, and centre to load eligible agents" : undefined}
              >
                <SelectValue placeholder="Assign LA">{laSelectDisplayLabel ?? undefined}</SelectValue>
              </SelectTrigger>
              <SelectContent
                style={{
                  borderRadius: 12,
                  border: `1px solid ${T.border}`,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                  backgroundColor: "#fff",
                  padding: 6,
                  maxHeight: 300,
                  zIndex: 99999,
                }}
              >
                {eligibleState?.loading && (
                  <div style={{ padding: "8px 10px", fontSize: 12, fontWeight: 700, color: T.textMuted }}>
                    Loading eligible agents…
                  </div>
                )}
                {eligibleState?.error && (
                  <div style={{ padding: "8px 10px", fontSize: 12, fontWeight: 700, color: "#b91c1c" }}>
                    {eligibleState.error}
                  </div>
                )}
                {eligibleState?.unmatchedEligible && eligibleState.unmatchedEligible.length > 0 && (
                  <div style={{ padding: "8px 10px", fontSize: 11, fontWeight: 600, color: T.textMuted, lineHeight: 1.4 }}>
                    No unique CRM user for eligible name(s) (duplicate first names need tie-break — see team):{" "}
                    {eligibleState.unmatchedEligible.join(", ")}
                  </div>
                )}
                {laOptionsForRow.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    style={{
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 14,
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
            </div>
            <input
              type="number"
              placeholder="ETA"
              min={0}
              value={draft.eta}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...draft, eta: e.target.value } }))}
              style={{
                width: "100%",
                height: QUEUE_CONTROL_HEIGHT,
                minHeight: QUEUE_CONTROL_HEIGHT,
                boxSizing: "border-box",
                border: `1.5px solid ${T.border}`,
                borderRadius: 10,
                padding: "0 10px",
                fontSize: 14,
                fontWeight: 600,
                color: T.textDark,
                background: "#fff",
                outline: "none",
                fontFamily: T.font,
                transition: "all 0.15s ease-in-out",
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
                height: QUEUE_CONTROL_HEIGHT,
                minHeight: QUEUE_CONTROL_HEIGHT,
                padding: "0 18px",
                fontSize: 14,
                fontWeight: 800,
                cursor: isSaving ? "not-allowed" : "pointer",
                opacity: isSaving ? 0.65 : 1,
                transition: "all 0.15s ease-in-out",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxSizing: "border-box",
              }}
            >
              Save
            </button>
          </div>
        )}

        {(showReady || showSendTransfer) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {showReady && (
              <button
                type="button"
                disabled={isSaving || !currentUserId}
                onClick={() => runAction(row.id, () => markQueueReady(supabase, row, String(currentUserId), queueRole as "ba" | "la"))}
                style={{
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  background: T.pageBg,
                  color: T.textDark,
                  fontSize: 12,
                  fontWeight: 900,
                  padding: "7px 12px",
                  cursor: isSaving ? "not-allowed" : "pointer",
                }}
              >
                Mark ready
              </button>
            )}
            {showSendTransfer && (
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
                  padding: "7px 12px",
                  cursor: isSaving ? "not-allowed" : "pointer",
                  opacity: isSaving ? 0.65 : 1,
                }}
              >
                Send transfer
              </button>
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
            <Search size={16} style={{ position: "absolute", left: 12, pointerEvents: "none", color: T.textMuted }} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search queue..."
              style={{
                height: QUEUE_CONTROL_HEIGHT,
                width: "100%",
                boxSizing: "border-box",
                paddingLeft: 36,
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
              }}
              className="hover:border-[#233217] focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadSnapshot(true)}
          style={{
            height: QUEUE_CONTROL_HEIGHT,
            minHeight: QUEUE_CONTROL_HEIGHT,
            padding: "0 16px",
            borderRadius: 10,
            border: `1px solid ${T.border}`,
            background: "#233217",
            color: "#fff",
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 6px 16px rgba(35, 50, 23, 0.18)",
            flexShrink: 0,
            boxSizing: "border-box",
          }}
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
            gap: 16,
            alignContent: "start",
          }}
        >
          {grouped.map((section) => (
            <div key={section.key} style={{ display: "grid", gap: 10 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: T.textMuted,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {section.title}{" "}
                <span style={{ color: T.textDark }}>({section.items.length})</span>
              </div>
              {section.items.length === 0 ? (
                <div style={{ fontSize: 12, color: T.textMuted, border: `1px dashed ${T.border}`, borderRadius: 12, padding: 12 }}>
                  No calls
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {section.items.map(renderCard)}
                </div>
              )}
            </div>
          ))}
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
    </div>
  );
}

