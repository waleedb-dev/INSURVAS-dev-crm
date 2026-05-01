"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, ChevronDown, Loader2, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { TransferStyledSelect } from "@/components/dashboard/pages/TransferStyledSelect";
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

type QueueSectionKey = "assignedToMe" | "unclaimed" | "baActive" | "laActive";

/**
 * Section headers: darker Insurvas greens (deepest → lighter) so each band reads clearly.
 * Text is always light for contrast on these fills.
 */
const QUEUE_SECTION_PILLS: Record<
  QueueSectionKey,
  { background: string; color: string; border?: string }
> = {
  assignedToMe: {
    background: T.asideChrome,
    color: "#f4f7f2",
    border: `1px solid ${T.blueHover}`,
  },
  unclaimed: {
    background: T.blueHover,
    color: "#f6faf3",
    border: `1px solid ${T.asideChrome}`,
  },
  baActive: {
    background: T.blue,
    color: "#f7faf5",
    border: `1px solid ${T.blueHover}`,
  },
  laActive: {
    background: T.textMuted,
    color: "#f4f7f2",
    border: `1px solid ${T.blueHover}`,
  },
};

/** Collapse accidental duplicated client labels (e.g. same string pasted twice). */
function displayQueueClientName(raw: string | null | undefined): string {
  const n = (raw ?? "").trim();
  if (!n) return "Unnamed client";
  const half = Math.floor(n.length / 2);
  if (half >= 3 && n.slice(0, half) === n.slice(half)) return n.slice(0, half).trim();
  return n;
}

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
  const [assignees, setAssignees] = useState<QueueAssignee[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftAssign>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [transferCheckModalOpen, setTransferCheckModalOpen] = useState(false);
  const [transferCheckModalLoading, setTransferCheckModalLoading] = useState(false);
  const [transferCheckModalClient, setTransferCheckModalClient] = useState("");
  const [transferCheckModalSnapshot, setTransferCheckModalSnapshot] =
    useState<TransferScreeningSnapshot>(IDLE_TRANSFER_SCREENING);

  const [sectionOpen, setSectionOpen] = useState<Record<QueueSectionKey, boolean>>({
    assignedToMe: true,
    unclaimed: true,
    baActive: true,
    laActive: true,
  });

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
  /** Avoid listing the same unclaimed row in both "Assigned to you" and "Unclaimed transfers". */
  const unclaimedForDisplay = useMemo(() => {
    if (queueRole !== "la" && queueRole !== "ba") return grouped.unclaimed;
    const mine = new Set(assignedToMe.map((r) => r.id));
    return grouped.unclaimed.filter((r) => !mine.has(r.id));
  }, [grouped.unclaimed, assignedToMe, queueRole]);
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
    const showReady =
      (queueRole === "ba" && (row.queue_type === "unclaimed_transfer" || row.queue_type === "ba_active")) ||
      (queueRole === "la" && (row.queue_type === "unclaimed_transfer" || row.queue_type === "ba_active"));
    const readyLabel = row.queue_type === "unclaimed_transfer" ? "Claim" : "Mark ready";
    const hasAnyAssignment = Boolean(row.assigned_ba_id || row.assigned_la_id);
    const assignedBaName = row.assigned_ba_id
      ? assigneeNameById.get(row.assigned_ba_id) ?? "Assigned BA"
      : null;
    const assignedLaName = row.assigned_la_id
      ? assigneeNameById.get(row.assigned_la_id) ?? "Assigned LA"
      : null;

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

    const clientLabel = displayQueueClientName(row.client_name);

    return (
      <div
        key={row.id}
        style={{
          border: `1px solid ${hasAnyAssignment ? T.memberSky : T.border}`,
          borderRadius: T.radiusMd,
          background: hasAnyAssignment ? T.rowBg : T.cardBg,
          padding: "18px 18px 16px",
          display: "grid",
          gap: 14,
          boxShadow: T.shadowSm,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: T.textDark,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                letterSpacing: "-0.02em",
              }}
              title={clientLabel}
            >
              {clientLabel}
            </div>
            {hasAnyAssignment && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  color: T.blueHover,
                  background: T.blueLight,
                  border: `1px solid ${T.border}`,
                  borderRadius: 999,
                  padding: "4px 9px",
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
              fontWeight: 700,
              color: T.textMuted,
              flexShrink: 0,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {elapsedLabel(row.queued_at)}
          </div>
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: T.textMuted,
            lineHeight: 1.5,
          }}
        >
          {(row.call_center_name || "Unknown centre")} · {row.state || "N/A"} · {row.carrier || "N/A"}
        </div>
        {(assignedBaName || assignedLaName) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {assignedBaName && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: T.textMid,
                  background: T.blueLight,
                  border: `1px solid ${T.borderLight}`,
                  borderRadius: 999,
                  padding: "5px 11px",
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
                  color: T.textMid,
                  background: T.pageBg,
                  border: `1px solid ${T.borderLight}`,
                  borderRadius: 999,
                  padding: "5px 11px",
                }}
              >
                LA: {assignedLaName}
              </span>
            )}
          </div>
        )}

        {queueRole === "manager" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) 84px minmax(min-content, auto)",
              gap: 10,
              alignItems: "stretch",
              marginTop: 2,
              paddingTop: 16,
              borderTop: `1px solid ${T.borderLight}`,
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
              <Select
                value={draft.laId ? draft.laId : undefined}
                onValueChange={(val) => {
                  const next = val ?? "";
                  setDrafts((prev) => ({
                    ...prev,
                    [row.id]: { ...draft, laId: next === "__unassigned__" ? "" : next },
                  }));
                }}
                onOpenChange={(opened) => {
                  if (!opened) return;
                  void ensureEligibleLoaded();
                }}
              >
                <SelectTrigger
                  style={{
                    width: "100%",
                    height: WIDGET_CONTROL_HEIGHT,
                    minHeight: WIDGET_CONTROL_HEIGHT,
                    borderRadius: 10,
                    border: `1.5px solid ${T.border}`,
                    backgroundColor: T.cardBg,
                    color: draft.laId ? T.textDark : T.textMuted,
                    fontSize: 13,
                    fontWeight: 600,
                    paddingLeft: 12,
                    paddingRight: 10,
                    transition: "all 0.15s ease-in-out",
                    opacity: !eligibilityKey ? 0.7 : 1,
                    boxSizing: "border-box",
                  }}
                  className="hover:border-[#638b4b] focus:border-[#638b4b] focus:ring-2 focus:ring-[#638b4b]/20"
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
                        fontSize: 13,
                        fontWeight: 400,
                        color: T.textDark,
                        cursor: "pointer",
                        transition: "all 0.1s ease-in-out",
                      }}
                      className="hover:bg-[#ddecd4] hover:text-[#3b5229] focus:bg-[#ddecd4] focus:text-[#3b5229] data-[state=checked]:bg-[#638b4b] data-[state=checked]:text-white data-[state=checked]:font-semibold"
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
              className="hover:border-[#638b4b] focus:border-[#638b4b] focus:ring-2 focus:ring-[#638b4b]/20"
            />
            <button
              type="button"
              disabled={isSaving || !currentUserId}
              onClick={() => void runManagerAssignWithTransferCheck(row, draft)}
              style={{
                border: "none",
                borderRadius: 10,
                background: T.blue,
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                height: WIDGET_CONTROL_HEIGHT,
                minHeight: WIDGET_CONTROL_HEIGHT,
                padding: "0 18px",
                cursor: isSaving ? "not-allowed" : "pointer",
                opacity: isSaving ? 0.65 : 1,
                boxShadow: T.shadowSm,
                flexShrink: 0,
                boxSizing: "border-box",
                fontFamily: T.font,
              }}
              className="transition-all duration-150 ease-in-out hover:brightness-95 active:scale-[0.98]"
            >
              Save
            </button>
          </div>
        )}

        {(showReady || showSendTransfer) && (
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              paddingTop: queueRole === "manager" ? 4 : 2,
              marginTop: queueRole === "manager" ? 0 : 0,
            }}
          >
            {showReady && (
              <button
                type="button"
                disabled={isSaving || !currentUserId}
                onClick={() =>
                  runAction(row.id, () => markQueueReady(supabase, row, String(currentUserId), queueRole as "ba" | "la"))
                }
                style={{
                  border: "none",
                  borderRadius: 10,
                  background: T.blue,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 800,
                  padding: "11px 16px",
                  cursor: isSaving ? "not-allowed" : "pointer",
                  opacity: isSaving ? 0.65 : 1,
                  boxShadow: T.shadowSm,
                  fontFamily: T.font,
                }}
                className="transition-all duration-150 ease-in-out hover:brightness-95 active:scale-[0.98]"
              >
                {readyLabel}
              </button>
            )}
            {showSendTransfer && (
              <button
                type="button"
                disabled={isSaving || !currentUserId}
                onClick={() => runAction(row.id, () => sendQueueTransfer(supabase, row, String(currentUserId)))}
                style={{
                  border: `1.5px solid ${T.border}`,
                  borderRadius: 10,
                  background: T.cardBg,
                  color: T.textDark,
                  fontSize: 12,
                  fontWeight: 800,
                  padding: "11px 16px",
                  cursor: isSaving ? "not-allowed" : "pointer",
                  opacity: isSaving ? 0.65 : 1,
                  boxShadow: T.shadowSm,
                  fontFamily: T.font,
                }}
                className="transition-all duration-150 ease-in-out hover:bg-[#f2f8ee] active:scale-[0.98]"
              >
                Send transfer
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCollapsibleSection = (sectionKey: QueueSectionKey, title: string, items: LeadQueueItem[]) => {
    const isOpen = sectionOpen[sectionKey];
    const pill = QUEUE_SECTION_PILLS[sectionKey];
    const countChipBg = "rgba(255,255,255,0.26)";
    const chevronColor = "rgba(244,247,242,0.95)";

    return (
      <div
        className="overflow-hidden rounded-xl bg-white transition-all duration-150 ease-in-out hover:shadow-md"
        style={{ border: `1px solid ${T.border}`, boxShadow: T.shadowSm }}
      >
        <button
          type="button"
          className="w-full px-4 py-3 text-left transition-transform duration-150 ease-in-out active:scale-[0.998]"
          style={{ fontFamily: T.font, background: "transparent", border: "none", margin: 0 }}
          aria-expanded={isOpen}
          id={`queue-section-${sectionKey}-trigger`}
          onClick={() => setSectionOpen((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }))}
        >
          <span
            className={cn(
              "flex min-h-[42px] w-full min-w-0 items-center gap-3 rounded-xl px-3.5 py-2.5 transition-[filter,box-shadow] duration-150 ease-in-out",
              "hover:brightness-110 active:brightness-[0.97]",
            )}
            style={{
              background: pill.background,
              color: pill.color,
              border: pill.border,
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "-0.015em",
              boxSizing: "border-box",
            }}
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-200 ease-in-out",
                isOpen ? "rotate-180" : "rotate-0",
              )}
              style={{ color: chevronColor }}
              aria-hidden
            />
            <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
              <span className="min-w-0 truncate text-left">{title}</span>
              <span
                className="shrink-0 tabular-nums"
                style={{
                  background: countChipBg,
                  borderRadius: 8,
                  padding: "2px 8px",
                  fontSize: 11,
                  fontWeight: 900,
                }}
              >
                {items.length}
              </span>
            </span>
          </span>
        </button>
        {isOpen && (
          <div
            className="px-4 pb-5 pt-1"
            style={{
              borderTop: `1px solid ${T.borderLight}`,
              background: T.pageBg,
              fontFamily: T.font,
            }}
            role="region"
            aria-labelledby={`queue-section-${sectionKey}-trigger`}
          >
            {items.length === 0 ? (
              <div
                className="rounded-xl px-5 py-12 text-center"
                style={{
                  border: `1px dashed ${T.border}`,
                  background: T.cardBg,
                }}
              >
                <p className="text-sm font-semibold" style={{ color: T.textMuted }}>
                  No calls
                </p>
                <p className="mt-2 text-xs font-medium leading-relaxed" style={{ color: T.textMuted, opacity: 0.92 }}>
                  Nothing queued in this section right now.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">{items.map(renderCard)}</div>
            )}
          </div>
        )}
      </div>
    );
  };

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
            width: "min(720px, calc(100vw - 32px))",
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "min(88vh, calc(100vh - 120px))",
            display: "flex",
            flexDirection: "column",
            background: T.pageBg,
            border: `1px solid ${T.border}`,
            borderRadius: T.radiusLg,
            boxShadow: T.shadowLg,
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
              padding: "16px 18px",
              background: T.cardBg,
              borderBottom: `1px solid ${T.borderLight}`,
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => void loadSnapshot(true)}
                style={{
                  height: 38,
                  border: `1px solid ${T.blueHover}`,
                  borderRadius: 10,
                  background: T.asideChrome,
                  color: "#f4f7f2",
                  cursor: "pointer",
                  padding: "0 14px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 800,
                  fontFamily: T.font,
                  boxShadow: T.shadowSm,
                }}
                className="transition-all duration-150 ease-in-out hover:brightness-110 active:scale-[0.98]"
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
                  background: T.cardBg,
                  color: T.textMuted,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                className="transition-colors duration-150 hover:border-[#638b4b] hover:text-[#3b5229]"
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
              padding: "18px 18px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              background: T.pageBg,
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
                {queueRole !== "manager" &&
                  renderCollapsibleSection("assignedToMe", "Assigned to you (next)", assignedToMe)}
                {renderCollapsibleSection("unclaimed", "Unclaimed transfers", unclaimedForDisplay)}
                {(queueRole === "manager" || queueRole === "la") &&
                  renderCollapsibleSection("baActive", "BA active calls", grouped.baActive)}
                {(queueRole === "manager" || queueRole === "ba") &&
                  renderCollapsibleSection("laActive", "LA active calls", grouped.laActive)}
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
