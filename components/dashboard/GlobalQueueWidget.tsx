"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, ChevronDown, Loader2, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { TransferStyledSelect } from "@/components/dashboard/pages/TransferStyledSelect";
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
import { useDashboardContext } from "@/components/dashboard/DashboardContext";

type DraftAssign = {
  baId: string;
  laId: string;
  eta: string;
};

/** Match `TransferStyledSelect` trigger height for one aligned manager row */
const WIDGET_CONTROL_HEIGHT = 42;

/** Above `DashboardLayout` sticky header (`z-index: 2000`) and its dropdowns (`2100`). */
const QUEUE_WIDGET_Z_BASE = 4000;

/** Panel header row (padding + title + sync line); used to cap scroll area so the shell does not stretch. */
const QUEUE_PANEL_HEADER_RESERVED_PX = 92;

/** Queue FAB is `bottom: 16`; panel sits above it with a small gap so both stay visible. */
const QUEUE_FAB_BOTTOM_PX = 16;
const QUEUE_PANEL_GAP_ABOVE_FAB_PX = 10;
/** Approximate FAB control height (padding + icon + label). */
const QUEUE_FAB_APPROX_HEIGHT_PX = 46;
const QUEUE_PANEL_BOTTOM_PX =
  QUEUE_FAB_BOTTOM_PX + QUEUE_FAB_APPROX_HEIGHT_PX + QUEUE_PANEL_GAP_ABOVE_FAB_PX;

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

export default function GlobalQueueWidget() {
  const { currentRole, currentUserId, userCallCenterId } = useDashboardContext();
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
        fetchQueueSnapshot(supabase, queueRole, currentUserId, { callCenterId: userCallCenterId }),
        queueRole === "manager" ? fetchQueueAssignees(supabase) : Promise.resolve([]),
      ]);
      setRows(queueRows);
      setAssignees(agents);
      requestTransferScreeningBackfillForQueueRows(supabase, queueRows);
      setLastUpdatedAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load queue");
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [queueRole, supabase, currentUserId, userCallCenterId]);

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
    if (!currentUserId || (queueRole !== "ba" && queueRole !== "la")) return [] as LeadQueueItem[];
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
    const draft = drafts[row.id] ?? { baId: row.assigned_ba_id ?? "", laId: row.assigned_la_id ?? "", eta: row.eta_minutes != null ? String(row.eta_minutes) : "" };
    const isSaving = savingId === row.id;
    const showSendTransfer = queueRole === "ba" && row.queue_type === "ba_active" && !!row.la_ready_at;
    const showReady =
      (queueRole === "ba" && (row.queue_type === "unclaimed_transfer" || row.queue_type === "ba_active")) ||
      (queueRole === "la" && (row.queue_type === "unclaimed_transfer" || row.queue_type === "ba_active"));
    const readyLabel =
      row.queue_type === "unclaimed_transfer"
        ? "Claim"
        : queueRole === "la"
          ? "LA ready"
          : "Mark ready";
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
    const screeningPersisted = parsePersistedTransferScreening(row.transfer_screening_json);
    const screeningMeta = screeningPersisted ? transferScreeningBadgeMeta(screeningPersisted) : null;
    const screeningChrome = screeningMeta ? transferScreeningBadgeChrome(screeningMeta.tone) : null;

    return (
      <div
        key={row.id}
        style={{
          border: `1px solid ${hasAnyAssignment ? T.memberSky : T.border}`,
          borderRadius: T.radiusMd,
          background: hasAnyAssignment ? T.rowBg : T.cardBg,
          padding: "11px 12px 10px",
          display: "grid",
          gap: 7,
          boxShadow: T.shadowSm,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
              minWidth: 0,
              flex: 1,
            }}
            title={`${clientLabel} — ${row.call_center_name || "Unknown centre"} · ${row.state || "N/A"} · ${row.carrier || "N/A"}`}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                flexWrap: "wrap",
                gap: "6px 10px",
                minWidth: 0,
                rowGap: 4,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: T.textDark,
                  letterSpacing: "-0.02em",
                  flexShrink: 0,
                }}
              >
                {clientLabel}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: T.textMuted,
                  lineHeight: 1.45,
                  wordBreak: "break-word",
                }}
              >
                {(row.call_center_name || "Unknown centre")} · {row.state || "N/A"} · {row.carrier || "N/A"}
              </span>
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
        {screeningMeta && screeningChrome && (
          <div
            className="min-w-0 rounded-md py-1.5 pl-2.5 pr-2.5"
            style={{
              fontFamily: T.font,
              border: screeningChrome.border,
              borderLeft: `3px solid ${screeningChrome.color}`,
              background: screeningChrome.background,
            }}
            role="status"
          >
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 600,
                color: T.textDark,
                lineHeight: 1.5,
                wordBreak: "break-word",
              }}
            >
              {screeningMeta.message}
            </p>
          </div>
        )}
        {(assignedBaName || assignedLaName || row.eta_minutes != null) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            {assignedBaName && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: T.textMid,
                  background: T.blueLight,
                  border: `1px solid ${T.borderLight}`,
                  borderRadius: 999,
                  padding: "3px 9px",
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
                  padding: "3px 9px",
                }}
              >
                LA: {assignedLaName}
              </span>
            )}
            {row.eta_minutes != null && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: "#0f172a",
                  background: "#fef9c3",
                  border: "1px solid #fde047",
                  borderRadius: 999,
                  padding: "3px 9px",
                  fontVariantNumeric: "tabular-nums",
                }}
                title="Manager ETA (minutes)"
              >
                ETA {row.eta_minutes}m
              </span>
            )}
          </div>
        )}

        {queueRole === "manager" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) 84px minmax(min-content, auto)",
              gap: 8,
              alignItems: "stretch",
              marginTop: 0,
              paddingTop: 8,
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
                    borderRadius: 11,
                    border: `1px solid ${T.borderLight}`,
                    backgroundColor: T.pageBg,
                    color: draft.laId ? T.textDark : T.textMuted,
                    fontSize: 14,
                    fontWeight: 600,
                    paddingLeft: 14,
                    paddingRight: 12,
                    transition: "all 0.15s ease-in-out",
                    opacity: !eligibilityKey ? 0.7 : 1,
                    boxSizing: "border-box",
                    boxShadow: `${T.shadowSm}, inset 0 1px 0 rgba(255,255,255,0.65)`,
                  }}
                  className="transition-all duration-150 ease-in-out hover:border-[#c8d4bb] hover:shadow-md focus:border-[#94c278] focus:ring-2 focus:ring-[#94c278]/25 data-[state=open]:border-[#94c278] data-[state=open]:shadow-md"
                  title={!eligibilityKey ? "Needs carrier, state, and centre to load eligible agents" : undefined}
                >
                  <SelectValue placeholder="Assign LA">{laSelectDisplayLabel ?? undefined}</SelectValue>
                </SelectTrigger>
                <SelectContent
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${T.borderLight}`,
                    boxShadow: T.shadowMd,
                    backgroundColor: T.cardBg,
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
                border: `1px solid ${T.borderLight}`,
                borderRadius: 11,
                padding: "0 12px",
                fontSize: 14,
                fontWeight: 600,
                color: T.textDark,
                background: T.pageBg,
                outline: "none",
                fontFamily: T.font,
                boxShadow: `${T.shadowSm}, inset 0 1px 0 rgba(255,255,255,0.65)`,
              }}
              className="transition-all duration-150 ease-in-out hover:border-[#c8d4bb] hover:shadow-md focus:border-[#94c278] focus:ring-2 focus:ring-[#94c278]/25"
            />
            <button
              type="button"
              disabled={isSaving || !currentUserId}
              onClick={() => void runManagerAssign(row, draft)}
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
              gap: 8,
              flexWrap: "wrap",
              paddingTop: 0,
            }}
          >
            {showReady && (
              <button
                type="button"
                disabled={isSaving || !currentUserId}
                onClick={() =>
                  runAction(row.id, async () => {
                    await markQueueReady(supabase, row, String(currentUserId), queueRole as "ba" | "la");
                    await notifyLaReadyForTransferIfNeeded(supabase, {
                      queueItemBefore: row,
                      actorUserId: String(currentUserId),
                      actorRole: queueRole as "ba" | "la",
                    });
                  })
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

    return (
      <div
        className="overflow-hidden transition-[box-shadow,border-color] duration-200 ease-out"
        style={{
          borderRadius: T.radiusLg,
          border: `1px solid ${isOpen ? T.border : T.borderLight}`,
          background: "transparent",
          boxShadow: isOpen
            ? "0 12px 32px -14px rgba(59, 82, 41, 0.2), 0 4px 14px rgba(0, 0, 0, 0.06)"
            : "0 6px 20px -8px rgba(59, 82, 41, 0.16), 0 2px 8px rgba(0, 0, 0, 0.05)",
        }}
      >
        <button
          type="button"
          className={cn(
            "flex w-full min-h-[44px] min-w-0 items-center gap-3 text-left outline-none sm:gap-3",
            "transition-[filter,transform] duration-200 ease-out",
            "hover:brightness-[1.08] active:brightness-[0.93] active:scale-[0.997]",
            "focus-visible:ring-2 focus-visible:ring-[#94c278]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
          )}
          style={{
            fontFamily: T.font,
            background: pill.background,
            color: pill.color,
            border: "none",
            borderBottom: isOpen ? `1px solid rgba(0, 0, 0, 0.1)` : "none",
            margin: 0,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "-0.015em",
            boxSizing: "border-box",
            /* Inline padding so it wins over `globals.css` universal `* { padding: 0 }` */
            paddingTop: 11,
            paddingBottom: 11,
            paddingLeft: 22,
            paddingRight: 18,
          }}
          aria-expanded={isOpen}
          id={`queue-section-${sectionKey}-trigger`}
          onClick={() => setSectionOpen((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }))}
        >
          <span className="min-w-0 flex-1 truncate">{title}</span>
          <span
            className="flex shrink-0 items-center justify-center tabular-nums"
            style={{
              background: T.asideChrome,
              color: "#ffffff",
              borderRadius: 9999,
              minWidth: 28,
              minHeight: 28,
              padding: "4px 11px",
              fontSize: 11,
              fontWeight: 900,
              lineHeight: 1,
              border: `1px solid ${T.memberTeal}`,
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.18)",
            }}
          >
            {items.length}
          </span>
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-white transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
              isOpen ? "rotate-180" : "rotate-0",
            )}
            aria-hidden
          />
        </button>
        {isOpen && (
          <div
            className="px-3 pb-3 pt-2.5 sm:px-4 sm:pb-3.5"
            style={{
              background: `linear-gradient(180deg, ${T.blueFaint} 0%, ${T.pageBg} 48%, ${T.pageBg} 100%)`,
              fontFamily: T.font,
            }}
            role="region"
            aria-labelledby={`queue-section-${sectionKey}-trigger`}
          >
            {items.length === 0 ? (
              <div
                className="rounded-xl px-4 py-7 text-center"
                style={{
                  border: `1px dashed ${T.border}`,
                  background: T.cardBg,
                  boxShadow: T.shadowSm,
                }}
              >
                <p className="text-sm font-semibold" style={{ color: T.textMuted }}>
                  No calls
                </p>
                <p className="mt-1.5 text-xs font-medium leading-relaxed" style={{ color: T.textMuted, opacity: 0.92 }}>
                  Nothing queued in this section right now.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">{items.map(renderCard)}</div>
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
          bottom: QUEUE_FAB_BOTTOM_PX,
          zIndex: QUEUE_WIDGET_Z_BASE,
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
            bottom: QUEUE_PANEL_BOTTOM_PX,
            zIndex: QUEUE_WIDGET_Z_BASE + 10,
            width: "min(620px, calc(100vw - 32px))",
            maxWidth: "calc(100vw - 32px)",
            maxHeight: `calc(100vh - ${QUEUE_PANEL_BOTTOM_PX}px - 24px)`,
            display: "flex",
            flexDirection: "column",
            background: T.cardBg,
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
              padding: "14px 16px",
              background: T.cardBg,
              borderBottom: `1px solid ${T.borderLight}`,
            }}
          >
            <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: T.textDark, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                Transfer queue
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, lineHeight: 1.3 }}>
                {lastUpdatedAt ? `Last sync ${new Date(lastUpdatedAt).toLocaleTimeString()}` : "Not synced yet"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, alignSelf: "center" }}>
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
              flex: "0 1 auto",
              minHeight: 0,
              maxHeight: `calc(100vh - ${QUEUE_PANEL_BOTTOM_PX}px - 24px - ${QUEUE_PANEL_HEADER_RESERVED_PX}px)`,
              overflowX: "hidden",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              overscrollBehaviorY: "contain",
              padding: "10px 14px 12px",
              background: T.cardBg,
            }}
          >
            <div className="flex flex-col gap-1.5">
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
                  {(queueRole === "ba" || queueRole === "la") &&
                    renderCollapsibleSection("assignedToMe", "Assigned to you (next)", assignedToMe)}
                  {renderCollapsibleSection("unclaimed", "Unclaimed transfers", unclaimedForDisplay)}
                  {(queueRole === "manager" ||
                    queueRole === "ba" ||
                    queueRole === "la" ||
                    queueRole === "call_center_agent" ||
                    queueRole === "call_center_admin") &&
                    renderCollapsibleSection("baActive", "BA active calls", grouped.baActive)}
                  {(queueRole === "manager" ||
                    queueRole === "la" ||
                    queueRole === "call_center_agent" ||
                    queueRole === "call_center_admin") &&
                    renderCollapsibleSection("laActive", "LA active calls", grouped.laActive)}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
