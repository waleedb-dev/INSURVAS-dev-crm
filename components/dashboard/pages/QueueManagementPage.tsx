"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { T } from "@/lib/theme";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { TransferStyledSelect } from "./TransferStyledSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  fetchQueueAssignees,
  fetchQueueSnapshot,
  managerAssignQueueItem,
  markQueueReady,
  resolveQueueRole,
  sendQueueTransfer,
  type LeadQueueItem,
} from "@/lib/queue/queueClient";

type Props = {
  /** Embedded inside Live Monitoring: tighter paddings and no outer card chrome. */
  variant?: "default" | "liveMonitoringEmbed";
};

type DraftAssign = {
  baId: string;
  laId: string;
  eta: string;
};

type EligibleAgentsResponse =
  | {
      success?: boolean;
      eligible_agents_count?: number;
      eligible_agents?: Array<{ name: string; upline?: string | null; upline_required?: boolean | null }>;
    }
  | { error?: string };

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

function normaliseUsState(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const t = raw.toUpperCase();
  const MAP: Record<string, string> = {
    AL: "Alabama",
    AK: "Alaska",
    AZ: "Arizona",
    AR: "Arkansas",
    CA: "California",
    CO: "Colorado",
    CT: "Connecticut",
    DE: "Delaware",
    DC: "District of Columbia",
    FL: "Florida",
    GA: "Georgia",
    HI: "Hawaii",
    ID: "Idaho",
    IL: "Illinois",
    IN: "Indiana",
    IA: "Iowa",
    KS: "Kansas",
    KY: "Kentucky",
    LA: "Louisiana",
    ME: "Maine",
    MD: "Maryland",
    MA: "Massachusetts",
    MI: "Michigan",
    MN: "Minnesota",
    MS: "Mississippi",
    MO: "Missouri",
    MT: "Montana",
    NE: "Nebraska",
    NV: "Nevada",
    NH: "New Hampshire",
    NJ: "New Jersey",
    NM: "New Mexico",
    NY: "New York",
    NC: "North Carolina",
    ND: "North Dakota",
    OH: "Ohio",
    OK: "Oklahoma",
    OR: "Oregon",
    PA: "Pennsylvania",
    RI: "Rhode Island",
    SC: "South Carolina",
    SD: "South Dakota",
    TN: "Tennessee",
    TX: "Texas",
    UT: "Utah",
    VT: "Vermont",
    VA: "Virginia",
    WA: "Washington",
    WV: "West Virginia",
    WI: "Wisconsin",
    WY: "Wyoming",
  };
  return MAP[t] || raw;
}

export default function QueueManagementPage({ variant = "default" }: Props) {
  const { currentRole, currentUserId } = useDashboardContext();
  const queueRole = useMemo(() => resolveQueueRole(currentRole), [currentRole]);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const isEmbed = variant === "liveMonitoringEmbed";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [rows, setRows] = useState<LeadQueueItem[]>([]);
  const [assignees, setAssignees] = useState<Array<{ id: string; name: string; queueRole: "ba" | "la" }>>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftAssign>>({});

  const [searchTerm, setSearchTerm] = useState("");
  const [groupBy, setGroupBy] = useState<"none" | "queue_type" | "centre">("none");
  const [language, setLanguage] = useState<"English" | "Spanish">("English");

  const [eligibleCache, setEligibleCache] = useState<
    Record<
      string,
      {
        loading: boolean;
        loaded: boolean;
        error: string | null;
        options: Array<{ value: string; label: string }>;
      }
    >
  >({});

  const fetchEligibleAgents = useCallback(
    async (args: { carrier: string; state: string; leadVendor: string; language: "English" | "Spanish" }) => {
      const key = `${args.carrier}||${args.state}||${args.leadVendor}||${args.language}`;
      const hit = eligibleCache[key];
      if (hit?.loading) return key;
      if (hit?.loaded) return key;

      setEligibleCache((prev) => ({
        ...prev,
        [key]: { loading: true, loaded: false, error: null, options: [] },
      }));

      try {
        const resp = await fetch("/api/get-eligible-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            carrier: args.carrier,
            state: args.state,
            lead_vendor: args.leadVendor,
            language: args.language,
          }),
        });
        const payload = (await resp.json()) as EligibleAgentsResponse;
        if (!resp.ok) {
          const msg =
            (payload && "error" in payload && typeof payload.error === "string" && payload.error) ||
            `HTTP ${resp.status}`;
          throw new Error(msg);
        }

        const list = (payload && "eligible_agents" in payload ? payload.eligible_agents : null) ?? [];
        const options = list
          .map((a) => {
            const name = String(a?.name ?? "").trim();
            if (!name) return null;
            const needsUpline = Boolean(a?.upline_required);
            return {
              value: name,
              label: needsUpline ? `${name} (upline required)` : name,
            };
          })
          .filter(Boolean) as Array<{ value: string; label: string }>;

        setEligibleCache((prev) => ({
          ...prev,
          [key]: {
            loading: false,
            loaded: true,
            error: null,
            options: [{ value: "__unassigned__", label: "Unassigned" }, ...options],
          },
        }));
      } catch (e) {
        setEligibleCache((prev) => ({
          ...prev,
          [key]: {
            loading: false,
            loaded: true,
            error: e instanceof Error ? e.message : "Failed to load eligible agents",
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
          fetchQueueSnapshot(supabase, queueRole, currentUserId),
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
    [queueRole, supabase, currentUserId],
  );

  useEffect(() => {
    void loadSnapshot(false);
    const timer = window.setInterval(() => {
      void loadSnapshot(true);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadSnapshot]);

  const assigneeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assignees) map.set(a.id, a.name);
    return map;
  }, [assignees]);

  const groupByOptions = useMemo(
    () => [
      { value: "none", label: "No grouping" },
      { value: "queue_type", label: "Queue type" },
      { value: "centre", label: "Centre" },
    ],
    [],
  );

  const baAssigneeOptions = useMemo(() => {
    const opts = assignees
      .filter((a) => a.queueRole === "ba")
      .map((a) => ({ value: a.id, label: a.name }));
    return [{ value: "__unassigned__", label: "Unassigned" }, ...opts];
  }, [assignees]);

  const languageOptions = useMemo(
    () => [
      { value: "English", label: "English" },
      { value: "Spanish", label: "Spanish" },
    ],
    [],
  );

  const filteredRows = useMemo(
    () => rows.filter((r) => matchesSearch(r, searchTerm)),
    [rows, searchTerm],
  );

  const grouped = useMemo(() => {
    if (groupBy === "queue_type") {
      const map = new Map<string, LeadQueueItem[]>();
      for (const row of filteredRows) {
        const key = row.queue_type;
        const next = map.get(key) ?? [];
        next.push(row);
        map.set(key, next);
      }
      return Array.from(map.entries()).map(([key, items]) => ({ key, title: key.replaceAll("_", " "), items }));
    }
    if (groupBy === "centre") {
      const map = new Map<string, LeadQueueItem[]>();
      for (const row of filteredRows) {
        const key = (row.call_center_name || "Unknown centre").trim() || "Unknown centre";
        const next = map.get(key) ?? [];
        next.push(row);
        map.set(key, next);
      }
      return Array.from(map.entries()).map(([key, items]) => ({ key, title: key, items }));
    }
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
    return [];
  }, [filteredRows, groupBy, queueRole]);

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
        ? `${carrierForEligibility}||${stateForEligibility}||${vendorForEligibility}||${language}`
        : null;
    const eligibleState = eligibilityKey ? eligibleCache[eligibilityKey] : null;
    const laOptionsForRow =
      eligibilityKey && eligibleState?.loaded ? eligibleState.options : [];

    const ensureEligibleLoaded = async () => {
      if (!eligibilityKey) return;
      if (eligibleCache[eligibilityKey]?.loaded) return;
      await fetchEligibleAgents({
        carrier: carrierForEligibility,
        state: stateForEligibility,
        leadVendor: vendorForEligibility,
        language,
      });
    };

    return (
      <div
        key={row.id}
        style={{
          border: `1px solid ${hasAnyAssignment ? "#86b97b" : T.border}`,
          borderRadius: 12,
          background: hasAnyAssignment ? "#f6fbf4" : T.cardBg,
          padding: 10,
          display: "grid",
          gap: 8,
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

        <div style={{ fontSize: 11, color: T.textMuted }}>
          Action: <strong style={{ color: T.textDark }}>{row.action_required || "unknown"}</strong>
          {row.ba_verification_percent != null ? ` | Verification ${Number(row.ba_verification_percent).toFixed(0)}%` : ""}
          {row.eta_minutes != null ? ` | ETA ${row.eta_minutes}m` : ""}
          {row.la_ready_at ? " | LA ready" : ""}
        </div>

        {queueRole === "manager" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 78px auto", gap: 6 }}>
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
                  height: 42,
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
                }}
                className="hover:border-[#233217] focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
                title={!eligibilityKey ? "Needs carrier, state, and centre to load eligible agents" : undefined}
              >
                <SelectValue placeholder="Assign LA" />
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
            <input
              type="number"
              placeholder="ETA"
              min={0}
              value={draft.eta}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...draft, eta: e.target.value } }))}
              style={{
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: "7px 8px",
                fontSize: 12,
                background: T.pageBg,
              }}
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
                borderRadius: 10,
                background: "#233217",
                color: "#fff",
                fontSize: 12,
                fontWeight: 900,
                padding: "7px 12px",
                cursor: isSaving ? "not-allowed" : "pointer",
                opacity: isSaving ? 0.65 : 1,
                transition: "all 0.15s ease-in-out",
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
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: isEmbed ? 0 : "12px 14px",
          borderRadius: isEmbed ? 0 : 16,
          border: isEmbed ? "none" : `1px solid ${T.border}`,
          background: isEmbed ? "transparent" : T.cardBg,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", minWidth: 240, flex: "1 1 260px" }}>
            <Search size={16} style={{ position: "absolute", left: 12, pointerEvents: "none", color: T.textMuted }} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search queue..."
              style={{
                height: 38,
                width: "100%",
                paddingLeft: 36,
                paddingRight: 12,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600,
                color: T.textDark,
                background: T.pageBg,
                outline: "none",
                fontFamily: T.font,
                transition: "all 0.15s ease-in-out",
              }}
            />
          </div>
          <div style={{ minWidth: 220, flex: "0 0 220px" }}>
            <TransferStyledSelect
              value={groupBy}
              onValueChange={(val) => setGroupBy(val as "none" | "queue_type" | "centre")}
              options={groupByOptions}
              placeholder="No grouping"
            />
          </div>
          <div style={{ minWidth: 180, flex: "0 0 180px" }}>
            <TransferStyledSelect
              value={language}
              onValueChange={(val) => {
                const next = val === "Spanish" ? "Spanish" : "English";
                setLanguage(next);
              }}
              options={languageOptions}
              placeholder="Language"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadSnapshot(true)}
          style={{
            height: 38,
            padding: "0 14px",
            borderRadius: 12,
            border: `1px solid ${T.border}`,
            background: "#233217",
            color: "#fff",
            fontSize: 13,
            fontWeight: 900,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 6px 16px rgba(35, 50, 23, 0.18)",
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
            gap: 12,
            alignContent: "start",
          }}
        >
          {grouped.map((section) => (
            <div key={section.key} style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: T.textDark }}>
                {section.title} ({section.items.length})
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
    </div>
  );
}

