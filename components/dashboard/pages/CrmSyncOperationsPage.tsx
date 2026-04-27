"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { T } from "@/lib/theme";
import { Card } from "@/components/ui/card";
import {
  Table as ShadcnTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  fetchDealTrackerByPolicyNumber,
  fetchDealTrackerByPolicyNumbers,
  fetchDealTrackerCandidatesByNamesAndPhones,
  fetchDealTrackerUniqueCarrierAndCallCenterValues,
  type DealTrackerRow,
} from "@/lib/supabase/dealTrackerClient";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleSlash,
  Database,
  Link2,
  ListChecks,
  Lock,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

type LeadPolicyRow = {
  leadId: string;
  leadDisplayId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  stage: string;
  pipelineId: string | null;
  callCenterId: string | null;
  callCenterName: string | null;
  /** `policy_id` stored on the lead row itself — matched against deal_tracker.policy_number. */
  policyNumber: string;
  carrier: string | null;
  productType: string | null;
  monthlyPremium: string | null;
  leadValue: number | null;
  leadSource: string | null;
  submissionDate: string | null;
  updatedAt: string | null;
  syncRequired: boolean;
};

type BulkPreviewRow = {
  leadId: string;
  leadNameCrm: string;
  leadNameDt: string;
  callCenterCrm: string;
  callCenterDt: string;
  policyIdCrm: string;
  policyIdDt: string;
  carrierCrm: string;
  carrierDt: string;
};

type ExternalStatusTone = "matched" | "mismatch" | "missing" | "unknown" | "pending";

type ExternalStatus = {
  tone: ExternalStatusTone;
  label: string;
  ghlStage: string | null;
};

const ITEMS_PER_PAGE = 50;
const BULK_PREVIEW_ITEMS_PER_PAGE = 20;

const STATUS_COLORS: Record<ExternalStatusTone, { bg: string; color: string; dot: string }> = {
  matched: { bg: "#dcfce7", color: "#166534", dot: "#22c55e" },
  mismatch: { bg: "#fef3c7", color: "#92400e", dot: "#d97706" },
  missing: { bg: "#fee2e2", color: "#991b1b", dot: "#dc2626" },
  unknown: { bg: "#f3f4f6", color: "#3f3f46", dot: "#9ca3af" },
  pending: { bg: "#eef5ee", color: "#233217", dot: "#638b4b" },
};

function formatPhone(phone: string | null | undefined) {
  const raw = String(phone ?? "").replace(/\D/g, "");
  if (raw.length === 10) {
    return `+1 (${raw.slice(0, 3)}) ${raw.slice(3, 6)}-${raw.slice(6)}`;
  }
  if (raw.length === 11 && raw.startsWith("1")) {
    return `+1 (${raw.slice(1, 4)}) ${raw.slice(4, 7)}-${raw.slice(7)}`;
  }
  return phone || "";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatMoney(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `$${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function LoadingSpinner({ size = 40, label = "Loading..." }: { size?: number; label?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: `3px solid ${T.border}`,
          borderTopColor: "#233217",
          animation: "spin 0.8s linear infinite",
        }}
      />
      {label && (
        <span style={{ fontSize: 14, fontWeight: 500, color: T.textMuted }}>{label}</span>
      )}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <Card
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderRadius: 16,
        border: `1px solid ${T.border}`,
        borderBottom: `4px solid ${tone}`,
        background: `linear-gradient(135deg, color-mix(in srgb, ${tone} 20%, ${T.cardBg}) 0%, ${T.cardBg} 80%)`,
        boxShadow: hover
          ? "0 14px 40px rgba(28, 32, 26, 0.08), 0 4px 14px rgba(28, 32, 26, 0.05)"
          : "0 4px 12px rgba(0,0,0,0.03)",
        transform: hover ? "translateY(-3px)" : "translateY(0)",
        transition:
          "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
        padding: "20px 24px",
        minHeight: 100,
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        cursor: "default",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#233217",
            letterSpacing: "0.45px",
            textTransform: "uppercase",
            lineHeight: 1.25,
          }}
        >
          {label}
        </span>
        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: tone,
            lineHeight: 1.05,
            wordBreak: "break-all",
          }}
        >
          {value}
        </div>
      </div>
      <div
        style={{
          color: tone,
          backgroundColor: hover
            ? `color-mix(in srgb, ${tone} 24%, transparent)`
            : `color-mix(in srgb, ${tone} 15%, transparent)`,
          width: 44,
          height: 44,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition:
            "background-color 0.32s cubic-bezier(0.22, 1, 0.36, 1), transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
          transform: hover ? "scale(1.04)" : "scale(1)",
        }}
      >
        {icon}
      </div>
    </Card>
  );
}

function StatusPill({ status }: { status: ExternalStatus }) {
  const c = STATUS_COLORS[status.tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        backgroundColor: c.bg,
        color: c.color,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: c.dot,
        }}
      />
      {status.label}
    </span>
  );
}

type PipelineStageRow = { id: number; pipeline_id: number; name: string };

type StagesByName = Map<string, PipelineStageRow[]>;

function buildStagesByName(rows: PipelineStageRow[]): StagesByName {
  const byName: StagesByName = new Map();
  for (const row of rows) {
    const key = (row.name || "").trim().toLowerCase();
    if (!key) continue;
    const bucket = byName.get(key);
    if (bucket) bucket.push(row);
    else byName.set(key, [row]);
  }
  return byName;
}

type ResolvedStagePayload = {
  payload: Record<string, unknown>;
  preferred: PipelineStageRow | null;
  pipelineChanged: boolean;
};

function resolveStagePayload(
  currentPipelineId: number | null,
  targetStage: string,
  stagesByName: StagesByName,
): ResolvedStagePayload {
  const matches = stagesByName.get(targetStage.trim().toLowerCase()) ?? [];
  const preferred =
    (currentPipelineId != null
      ? matches.find((m) => m.pipeline_id === currentPipelineId)
      : undefined) ??
    matches[0] ??
    null;

  const payload: Record<string, unknown> = {
    stage: preferred ? preferred.name : targetStage,
  };
  let pipelineChanged = false;
  if (preferred) {
    payload.stage_id = preferred.id;
    if (currentPipelineId == null || preferred.pipeline_id !== currentPipelineId) {
      payload.pipeline_id = preferred.pipeline_id;
      pipelineChanged = true;
    }
  } else {
    payload.stage_id = null;
  }
  return { payload, preferred, pipelineChanged };
}

function computeStatus(
  localStage: string,
  external: DealTrackerRow | null,
  loaded: boolean,
): ExternalStatus {
  if (!loaded) {
    return { tone: "pending", label: "Not checked", ghlStage: null };
  }
  if (!external) {
    return { tone: "missing", label: "No match in Deal Tracker", ghlStage: null };
  }
  const ghl = (external.ghl_stage || "").trim();
  if (!ghl) {
    return { tone: "unknown", label: "No GHL stage set", ghlStage: null };
  }
  const localNormalised = (localStage || "").trim().toLowerCase();
  const ghlNormalised = ghl.toLowerCase();
  if (localNormalised && localNormalised === ghlNormalised) {
    return { tone: "matched", label: "Stage in sync", ghlStage: ghl };
  }
  return { tone: "mismatch", label: "Stage differs", ghlStage: ghl };
}

type TabView = "policy-attachment" | "crm-sync";

export default function CrmSyncOperationsPage() {
  const { currentRole } = useDashboardContext();
  const [activeTab, setActiveTab] = useState<TabView>("crm-sync");
  
  if (currentRole !== "system_admin") {
    return <AccessRestricted />;
  }
  
  return (
    <div style={{ fontFamily: T.font }}>
      {/* Tab Navigation */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          borderBottom: `1px solid ${T.border}`,
          paddingBottom: 0,
        }}
      >
        {[
          { key: "policy-attachment", label: "Policy Attachment & Review", icon: Link2 },
          { key: "crm-sync", label: "CRM Sync", icon: RefreshCw },
        ].map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key as TabView)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 20px",
                borderRadius: "10px 10px 0 0",
                border: "none",
                borderBottom: isActive ? "3px solid #233217" : "3px solid transparent",
                backgroundColor: isActive ? "#EEF5EE" : "transparent",
                color: isActive ? "#233217" : "#647864",
                fontSize: 14,
                fontWeight: isActive ? 700 : 600,
                fontFamily: T.font,
                cursor: "pointer",
                transition: "all 0.15s ease-in-out",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "#f5f9f5";
                  e.currentTarget.style.color = "#233217";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#647864";
                }
              }}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </div>
      
      {activeTab === "policy-attachment" ? (
        <PolicyAttachmentTab />
      ) : (
        <CrmSyncOperationsPageInner />
      )}
    </div>
  );
}

function AccessRestricted() {
  return (
    <div
      style={{
        fontFamily: T.font,
        padding: "60px 20px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          padding: "32px 28px",
          borderRadius: 20,
          border: `1px solid ${T.border}`,
          background: T.cardBg,
          textAlign: "center",
          boxShadow: "0 12px 32px rgba(15, 23, 13, 0.06)",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "#eef5ee",
            color: "#233217",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Lock size={24} />
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 800,
            color: "#233217",
            letterSpacing: "-0.01em",
          }}
        >
          Restricted to system admins
        </h2>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 13,
            color: T.textMuted,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          CRM Sync Operations can overwrite lead stages across every pipeline. Only system
          administrators are permitted to run comparisons and sync from Deal Tracker. Please
          contact an admin if you need access.
        </p>
      </div>
    </div>
  );
}

function CrmSyncOperationsPageInner() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [rows, setRows] = useState<LeadPolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [externalByPolicy, setExternalByPolicy] = useState<Map<string, DealTrackerRow | null>>(
    new Map(),
  );
  const [externalLoaded, setExternalLoaded] = useState(false);
  const [externalLoading, setExternalLoading] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExternalStatusTone | "all">("all");
  const [pipelineFilter, setPipelineFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  
  // Pipeline and stage options
  const [pipelines, setPipelines] = useState<Array<{ id: string; name: string }>>([]);
  const [stages, setStages] = useState<Array<{ id: number; name: string; pipeline_id: number }>>([]);

  const [selectedRow, setSelectedRow] = useState<LeadPolicyRow | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalExternal, setModalExternal] = useState<DealTrackerRow | null>(null);
  const [mappingConfirmed, setMappingConfirmed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<
    { tone: "success" | "warning" | "error" | "info"; message: string } | null
  >(null);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [bulkResults, setBulkResults] = useState<
    Array<{
      key: string;
      leadId: string;
      leadName: string;
      policyNumber: string;
      fromStage: string;
      toStage: string;
      outcome: "updated" | "pipeline_changed" | "no_stage_row" | "skipped" | "error";
      message?: string;
    }>
  >([]);
  const [bulkFinished, setBulkFinished] = useState(false);
  const [syncBulkPreviewRows, setSyncBulkPreviewRows] = useState<CrmSyncBulkPreviewRow[]>([]);
  const [syncBulkPreviewPage, setSyncBulkPreviewPage] = useState(1);
  const [syncBulkPreviewFilter, setSyncBulkPreviewFilter] = useState<"all" | "different">("all");

  const buildCrmPreviewRow = useCallback(
    (q: { row: LeadPolicyRow; external: DealTrackerRow }): CrmSyncBulkPreviewRow => {
      const cc = q.external.cc_value;
      const leadValueTarget =
        cc != null && !Number.isNaN(Number(cc)) ? String(Number(cc)) : "";
      return {
        key: `${q.row.leadId}:${q.row.policyNumber}`,
        leadId: q.row.leadId,
        leadName: q.row.fullName,
        policyNumber: q.row.policyNumber,
        pipelineId: q.row.pipelineId,
        stageCrm: q.row.stage || "",
        stageTarget: (q.external.ghl_stage || "").trim(),
        leadValueCrm: q.row.leadValue != null ? String(q.row.leadValue) : "",
        leadValueTarget,
      };
    },
    [],
  );

  // Load pipelines and stages
  useEffect(() => {
    const fetchOptions = async () => {
      const [{ data: pipelineData }, { data: stageData }] = await Promise.all([
        supabase.from("pipelines").select("id, name").order("name"),
        supabase.from("pipeline_stages").select("id, name, pipeline_id").order("position"),
      ]);
      setPipelines(pipelineData || []);
      setStages(stageData || []);
    };
    fetchOptions();
  }, [supabase]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setExternalLoaded(false);
    setExternalByPolicy(new Map());
    setExternalError(null);

    // Paginate with keyset on id — PostgREST limits each response to max_rows (often 1000).
    // Offset/range over order(updated_at desc) is unstable when timestamps tie and can stop early.
    const PAGE_SIZE = 1000;
    const collected: Record<string, unknown>[] = [];
    let cursorId: string | null = null;
    const MAX_ROWS = 50000;

    while (collected.length < MAX_ROWS) {
      let query = supabase
        .from("leads")
        .select(
          "id, lead_unique_id, first_name, last_name, phone, stage, pipeline_id, call_center_id, policy_id, carrier, product_type, monthly_premium, lead_value, lead_source, submission_date, updated_at",
        )
        .not("policy_id", "is", null)
        .neq("policy_id", "")
        .order("id", { ascending: true })
        .limit(PAGE_SIZE);

      if (pipelineFilter !== "all") {
        query = query.eq("pipeline_id", pipelineFilter);
      }

      if (stageFilter !== "all") {
        query = query.eq("stage", stageFilter);
      }

      if (cursorId !== null) {
        query = query.gt("id", cursorId);
      }

      const { data: leadRows, error: leadErr } = await query;

      if (leadErr) {
        setLoadError(leadErr.message);
        setRows([]);
        setLoading(false);
        return;
      }
      const batch = (leadRows ?? []) as Record<string, unknown>[];
      if (batch.length === 0) break;
      collected.push(...batch);
      const lastIdRaw = batch[batch.length - 1]?.id;
      cursorId = lastIdRaw != null ? String(lastIdRaw) : null;
      if (!cursorId) break;
      if (batch.length < PAGE_SIZE) break;
    }

    const mapped: LeadPolicyRow[] = collected
      .map((lead) => {
        const pNum = String(lead?.policy_id ?? "").trim();
        if (!pNum) return null;
        const leadIdStr = lead?.id != null ? String(lead.id) : "";
        if (!leadIdStr) return null;
        const firstName = String(lead.first_name || "").trim();
        const lastName = String(lead.last_name || "").trim();
        const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Unnamed Lead";
        const displayId = lead.lead_unique_id ? String(lead.lead_unique_id) : leadIdStr;
        return {
          leadId: leadIdStr,
          leadDisplayId: displayId,
          firstName,
          lastName,
          fullName,
          phone: lead.phone != null ? String(lead.phone) : "",
          stage: lead.stage != null ? String(lead.stage) : "",
          pipelineId: lead.pipeline_id != null ? String(lead.pipeline_id) : null,
          callCenterId: lead.call_center_id != null ? String(lead.call_center_id) : null,
          callCenterName: null as string | null,
          policyNumber: pNum,
          carrier: lead.carrier != null ? String(lead.carrier) : null,
          productType: lead.product_type != null ? String(lead.product_type) : null,
          monthlyPremium: lead.monthly_premium != null ? String(lead.monthly_premium) : null,
          leadValue: lead.lead_value != null ? Number(lead.lead_value) : null,
          leadSource: lead.lead_source != null ? String(lead.lead_source) : null,
          submissionDate: lead.submission_date != null ? String(lead.submission_date) : null,
          updatedAt: lead.updated_at != null ? String(lead.updated_at) : null,
          syncRequired: lead.sync_required !== false,
        } satisfies LeadPolicyRow;
      })
      .filter((row): row is LeadPolicyRow => row !== null);

    mapped.sort((a, b) => {
      const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
      const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
      if (tb !== ta) return tb - ta;
      return b.leadId.localeCompare(a.leadId);
    });

    setRows(mapped);
    setLoading(false);
  }, [supabase, pipelineFilter, stageFilter]);

  useEffect(() => {
    void loadRows();
  }, [loadRows, pipelineFilter, stageFilter]);

  const [compareProgress, setCompareProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const runComparison = useCallback(async (): Promise<Map<
    string,
    DealTrackerRow | null
  > | null> => {
    if (rows.length === 0) {
      const empty = new Map<string, DealTrackerRow | null>();
      setExternalByPolicy(empty);
      setExternalLoaded(true);
      return empty;
    }
    setExternalLoading(true);
    setExternalError(null);
    setCompareProgress({ done: 0, total: 0 });
    try {
      const byPolicy = await fetchDealTrackerByPolicyNumbers(
        rows.map((r) => r.policyNumber),
        (done, total) => setCompareProgress({ done, total }),
      );
      const final = new Map<string, DealTrackerRow | null>();
      for (const r of rows) {
        final.set(r.policyNumber, byPolicy.get(r.policyNumber) ?? null);
      }
      setExternalByPolicy(final);
      setExternalLoaded(true);
      return final;
    } catch (e) {
      setExternalError(e instanceof Error ? e.message : "Failed to reach Deal Tracker database.");
      setExternalLoaded(false);
      return null;
    } finally {
      setExternalLoading(false);
      setCompareProgress(null);
    }
  }, [rows]);

  const rowsWithStatus = useMemo(() => {
    return rows.map((r) => {
      const ext = externalByPolicy.get(r.policyNumber) ?? null;
      const status = computeStatus(r.stage, ext, externalLoaded);
      return { row: r, external: ext, status };
    });
  }, [rows, externalByPolicy, externalLoaded]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const numericQ = q.replace(/\D/g, "");
    return rowsWithStatus.filter(({ row, status }) => {
      if (statusFilter !== "all" && status.tone !== statusFilter) return false;
      if (!q) return true;
      if (row.fullName.toLowerCase().includes(q)) return true;
      if (row.policyNumber.toLowerCase().includes(q)) return true;
      if (row.leadDisplayId.toLowerCase().includes(q)) return true;
      if ((row.carrier || "").toLowerCase().includes(q)) return true;
      if (numericQ && row.phone.replace(/\D/g, "").includes(numericQ)) return true;
      return false;
    });
  }, [rowsWithStatus, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pipelineFilter, stageFilter]);

  useEffect(() => {
    const needsComparison =
      statusFilter === "matched" ||
      statusFilter === "mismatch" ||
      statusFilter === "missing";
    if (!needsComparison) return;
    if (loading || externalLoading || externalLoaded || rows.length === 0) return;
    void runComparison();
  }, [statusFilter, loading, externalLoading, externalLoaded, rows.length, runComparison]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const stats = useMemo(() => {
    let matched = 0;
    let mismatch = 0;
    let missing = 0;
    for (const r of rowsWithStatus) {
      if (r.status.tone === "matched") matched++;
      else if (r.status.tone === "mismatch") mismatch++;
      else if (r.status.tone === "missing" || r.status.tone === "unknown") missing++;
    }
    return { total: rows.length, matched, mismatch, missing };
  }, [rowsWithStatus, rows.length]);

  const openMapping = useCallback(async (row: LeadPolicyRow) => {
    setSelectedRow(row);
    setMappingConfirmed(false);
    setSyncNotice(null);
    setModalError(null);
    setModalExternal(null);
    setModalLoading(true);
    try {
      const res = await fetchDealTrackerByPolicyNumber(row.policyNumber);
      setModalExternal(res);
      setExternalByPolicy((prev) => {
        const next = new Map(prev);
        next.set(row.policyNumber, res);
        return next;
      });
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Failed to load external record.");
    } finally {
      setModalLoading(false);
    }
  }, []);

  const closeMapping = useCallback(() => {
    setSelectedRow(null);
    setModalExternal(null);
    setModalError(null);
    setMappingConfirmed(false);
    setSyncing(false);
    setSyncNotice(null);
  }, []);

  const modalStatus = useMemo(() => {
    if (!selectedRow) return null;
    return computeStatus(selectedRow.stage, modalExternal, !modalLoading && !modalError);
  }, [selectedRow, modalExternal, modalLoading, modalError]);

  const rowKey = (row: LeadPolicyRow) => `${row.leadId}:${row.policyNumber}`;

  const syncableRowsWithStatus = useMemo(
    () =>
      rowsWithStatus.filter(
        ({ external, status }) =>
          status.tone === "mismatch" &&
          !!external &&
          !!(external.ghl_stage && external.ghl_stage.trim()),
      ),
    [rowsWithStatus],
  );

  const syncableKeysOnPage = useMemo(
    () =>
      filtered
        .slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
        .filter(
          ({ external, status }) =>
            status.tone === "mismatch" &&
            !!external &&
            !!(external.ghl_stage && external.ghl_stage.trim()),
        )
        .map(({ row }) => rowKey(row)),
    [filtered, page],
  );

  const toggleSelected = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAllOnPage = useCallback(() => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const k of syncableKeysOnPage) next.add(k);
      return next;
    });
  }, [syncableKeysOnPage]);

  const clearPageSelection = useCallback(() => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const k of syncableKeysOnPage) next.delete(k);
      return next;
    });
  }, [syncableKeysOnPage]);

  const clearAllSelection = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  const allOnPageSelected =
    syncableKeysOnPage.length > 0 && syncableKeysOnPage.every((k) => selectedKeys.has(k));
  const someOnPageSelected =
    !allOnPageSelected && syncableKeysOnPage.some((k) => selectedKeys.has(k));

  useEffect(() => {
    if (selectedKeys.size === 0) return;
    const valid = new Set(rowsWithStatus.map(({ row }) => rowKey(row)));
    setSelectedKeys((prev) => {
      const next = new Set<string>();
      for (const k of prev) if (valid.has(k)) next.add(k);
      return next.size === prev.size ? prev : next;
    });
  }, [rowsWithStatus, selectedKeys.size]);

  /** Selected leads that can be bulk-synced (must NOT depend on bulkOpen — preview is seeded before modal opens). */
  const bulkQueue = useMemo(() => {
    const byKey = new Map(
      rowsWithStatus.map(({ row, external }) => [rowKey(row), { row, external }]),
    );
    return Array.from(selectedKeys)
      .map((k) => byKey.get(k))
      .filter(
        (entry): entry is { row: LeadPolicyRow; external: DealTrackerRow | null } =>
          !!entry && !!entry.external,
      )
      .filter(
        (entry): entry is { row: LeadPolicyRow; external: DealTrackerRow } =>
          !!(entry.external && entry.external.ghl_stage && entry.external.ghl_stage.trim()),
      );
  }, [rowsWithStatus, selectedKeys]);

  const openBulkModal = useCallback(() => {
    if (selectedKeys.size === 0) return;
    const byKey = new Map(
      rowsWithStatus.map(({ row, external }) => [rowKey(row), { row, external }]),
    );
    const queue = Array.from(selectedKeys)
      .map((k) => byKey.get(k))
      .filter(
        (entry): entry is { row: LeadPolicyRow; external: DealTrackerRow | null } =>
          !!entry && !!entry.external,
      )
      .filter(
        (entry): entry is { row: LeadPolicyRow; external: DealTrackerRow } =>
          !!(entry.external && entry.external.ghl_stage && entry.external.ghl_stage.trim()),
      );
    setSyncBulkPreviewRows(queue.map(buildCrmPreviewRow));
    setSyncBulkPreviewPage(1);
    setSyncBulkPreviewFilter("all");
    setBulkOpen(true);
    setBulkRunning(false);
    setBulkFinished(false);
    setBulkResults([]);
    setBulkProgress({ done: 0, total: 0 });
  }, [selectedKeys, rowsWithStatus, buildCrmPreviewRow]);

  const [comparingAll, setComparingAll] = useState(false);

  const handleCompareAllAndPreview = useCallback(async () => {
    if (rows.length === 0 || comparingAll) return;
    setComparingAll(true);
    try {
      const freshExternal = await runComparison();
      if (!freshExternal) return;
      const nextKeys = new Set<string>();
      const previewRows: CrmSyncBulkPreviewRow[] = [];
      for (const r of rows) {
        const ext = freshExternal.get(r.policyNumber) ?? null;
        if (!ext) continue;
        const ghl = (ext.ghl_stage || "").trim();
        if (!ghl) continue;
        const localNormalised = (r.stage || "").trim().toLowerCase();
        if (localNormalised === ghl.toLowerCase()) continue;
        nextKeys.add(`${r.leadId}:${r.policyNumber}`);
        previewRows.push(buildCrmPreviewRow({ row: r, external: ext }));
      }
      setSelectedKeys(nextKeys);
      setSyncBulkPreviewRows(previewRows);
      setSyncBulkPreviewPage(1);
      setSyncBulkPreviewFilter("all");
      setBulkOpen(true);
      setBulkRunning(false);
      setBulkFinished(false);
      setBulkResults([]);
      setBulkProgress({ done: 0, total: 0 });
    } finally {
      setComparingAll(false);
    }
  }, [rows, runComparison, comparingAll, buildCrmPreviewRow]);

  const selectAllMismatched = useCallback(() => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const { row } of syncableRowsWithStatus) next.add(rowKey(row));
      return next;
    });
  }, [syncableRowsWithStatus]);

  const runBulkSync = useCallback(async () => {
    if (syncBulkPreviewRows.length === 0) return;

    setBulkRunning(true);
    setBulkFinished(false);
    setBulkResults([]);
    setBulkProgress({ done: 0, total: syncBulkPreviewRows.length });

    const targetNames = Array.from(
      new Set(
        syncBulkPreviewRows
          .map((q) => (q.stageTarget || "").trim())
          .filter((n) => n.length > 0),
      ),
    );
    const targetsLower = new Set(targetNames.map((n) => n.toLowerCase()));

    let stagesByName: StagesByName = new Map();
    try {
      if (targetNames.length > 0) {
        const { data: allStages, error: stageErr } = await supabase
          .from("pipeline_stages")
          .select("id, pipeline_id, name");
        if (stageErr) throw new Error(stageErr.message);
        const stageRows = ((allStages ?? []) as PipelineStageRow[]).filter((s) =>
          targetsLower.has(String(s.name ?? "").trim().toLowerCase()),
        );
        stagesByName = buildStagesByName(stageRows);
      }
    } catch (e) {
      setBulkResults(
        syncBulkPreviewRows.map((q) => ({
          key: q.key,
          leadId: q.leadId,
          leadName: q.leadName,
          policyNumber: q.policyNumber,
          fromStage: q.stageCrm,
          toStage: (q.stageTarget || "").trim(),
          outcome: "error" as const,
          message:
            e instanceof Error
              ? `Stage lookup failed: ${e.message}`
              : "Stage lookup failed before sync could start.",
        })),
      );
      setBulkProgress({ done: syncBulkPreviewRows.length, total: syncBulkPreviewRows.length });
      setBulkRunning(false);
      setBulkFinished(true);
      return;
    }

    const results: BulkResult[] = [];
    const updatedRows = new Map<
      string,
      { stage: string; pipelineId: string | null; leadValue?: number }
    >();

    let done = 0;
    for (const preview of syncBulkPreviewRows) {
      const target = (preview.stageTarget || "").trim();
      const fromStage = preview.stageCrm || "";

      if (!target) {
        results.push({
          key: preview.key,
          leadId: preview.leadId,
          leadName: preview.leadName,
          policyNumber: preview.policyNumber,
          fromStage,
          toStage: "",
          outcome: "skipped",
          message: "No target stage",
        });
        done += 1;
        setBulkProgress({ done, total: syncBulkPreviewRows.length });
        continue;
      }

      const lvRaw = String(preview.leadValueTarget ?? "").replace(/,/g, "").trim();
      let lvNum: number | null = null;
      if (lvRaw !== "") {
        const n = parseFloat(lvRaw);
        if (!Number.isNaN(n)) lvNum = n;
      }
      const crmLvParsed =
        preview.leadValueCrm.trim() !== ""
          ? parseFloat(preview.leadValueCrm.replace(/,/g, ""))
          : null;
      const needsLeadValueUpdate =
        lvNum != null &&
        (crmLvParsed == null ||
          Number.isNaN(crmLvParsed) ||
          Math.abs(crmLvParsed - lvNum) > 0.005);

      const stageNeedsUpdate =
        fromStage.trim().toLowerCase() !== target.toLowerCase();

      if (!stageNeedsUpdate && !needsLeadValueUpdate) {
        results.push({
          key: preview.key,
          leadId: preview.leadId,
          leadName: preview.leadName,
          policyNumber: preview.policyNumber,
          fromStage,
          toStage: target,
          outcome: "skipped",
          message: "Nothing to update",
        });
        done += 1;
        setBulkProgress({ done, total: syncBulkPreviewRows.length });
        continue;
      }

      if (!stageNeedsUpdate && needsLeadValueUpdate && lvNum != null) {
        const { error: lvErr } = await supabase
          .from("leads")
          .update({ lead_value: lvNum })
          .eq("id", preview.leadId);
        if (lvErr) {
          results.push({
            key: preview.key,
            leadId: preview.leadId,
            leadName: preview.leadName,
            policyNumber: preview.policyNumber,
            fromStage,
            toStage: target,
            outcome: "error",
            message: lvErr.message,
          });
        } else {
          updatedRows.set(preview.leadId, {
            stage: fromStage,
            pipelineId: preview.pipelineId,
            leadValue: lvNum,
          });
          results.push({
            key: preview.key,
            leadId: preview.leadId,
            leadName: preview.leadName,
            policyNumber: preview.policyNumber,
            fromStage,
            toStage: target,
            outcome: "updated",
            message: "Lead value synced",
          });
        }
        done += 1;
        setBulkProgress({ done, total: syncBulkPreviewRows.length });
        continue;
      }

      const currentPipelineId =
        preview.pipelineId != null && preview.pipelineId !== ""
          ? Number(preview.pipelineId)
          : null;
      const { payload, preferred, pipelineChanged } = resolveStagePayload(
        currentPipelineId,
        target,
        stagesByName,
      );

      if (lvNum != null) {
        (payload as Record<string, unknown>).lead_value = lvNum;
      }

      const { error: updateErr } = await supabase
        .from("leads")
        .update(payload)
        .eq("id", preview.leadId);

      if (updateErr) {
        results.push({
          key: preview.key,
          leadId: preview.leadId,
          leadName: preview.leadName,
          policyNumber: preview.policyNumber,
          fromStage,
          toStage: target,
          outcome: "error",
          message: updateErr.message,
        });
      } else {
        const nextPipelineId = preferred?.pipeline_id ?? currentPipelineId ?? null;
        updatedRows.set(preview.leadId, {
          stage: target,
          pipelineId: nextPipelineId != null ? String(nextPipelineId) : preview.pipelineId,
          ...(lvNum != null ? { leadValue: lvNum } : {}),
        });
        results.push({
          key: preview.key,
          leadId: preview.leadId,
          leadName: preview.leadName,
          policyNumber: preview.policyNumber,
          fromStage,
          toStage: target,
          outcome: preferred
            ? pipelineChanged
              ? "pipeline_changed"
              : "updated"
            : "no_stage_row",
          message: preferred
            ? pipelineChanged
              ? `Moved to pipeline #${preferred.pipeline_id}`
              : undefined
            : "Stage text saved but no pipeline_stages row exists — stage_id cleared",
        });
      }

      done += 1;
      setBulkProgress({ done, total: syncBulkPreviewRows.length });
    }

    if (updatedRows.size > 0) {
      setRows((prev) =>
        prev.map((r) => {
          const upd = updatedRows.get(r.leadId);
          if (!upd) return r;
          return {
            ...r,
            stage: upd.stage,
            pipelineId: upd.pipelineId,
            ...(upd.leadValue !== undefined ? { leadValue: upd.leadValue } : {}),
          };
        }),
      );
    }
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const r of results) {
        if (r.outcome !== "error") next.delete(r.key);
      }
      return next;
    });

    setBulkResults(results);
    setBulkRunning(false);
    setBulkFinished(true);
  }, [syncBulkPreviewRows, supabase]);

  const closeBulkModal = useCallback(() => {
    if (bulkRunning) return;
    setBulkOpen(false);
    setSyncBulkPreviewRows([]);
    setSyncBulkPreviewPage(1);
    setSyncBulkPreviewFilter("all");
  }, [bulkRunning]);

  const handleSync = useCallback(async () => {
    if (!selectedRow || !modalExternal) return;
    const targetStage = (modalExternal.ghl_stage || "").trim();
    if (!targetStage) {
      setSyncNotice({
        tone: "warning",
        message: "Deal Tracker record has no ghl_stage set — nothing to sync.",
      });
      return;
    }
    if (
      selectedRow.stage &&
      selectedRow.stage.trim().toLowerCase() === targetStage.toLowerCase()
    ) {
      setSyncNotice({
        tone: "info",
        message: `Lead is already on "${targetStage}". No update needed.`,
      });
      return;
    }

    setSyncing(true);
    setSyncNotice(null);

    try {
      const { data: stageMatches, error: stageLookupErr } = await supabase
        .from("pipeline_stages")
        .select("id, pipeline_id, name")
        .ilike("name", targetStage);
      if (stageLookupErr) throw new Error(stageLookupErr.message);

      const stagesByName = buildStagesByName(
        (stageMatches ?? []) as PipelineStageRow[],
      );

      const currentPipelineId =
        selectedRow.pipelineId != null && selectedRow.pipelineId !== ""
          ? Number(selectedRow.pipelineId)
          : null;

      const { payload: updatePayload, preferred: preferredMatch, pipelineChanged } =
        resolveStagePayload(currentPipelineId, targetStage, stagesByName);

      const resolvedStageId = preferredMatch?.id ?? null;
      const resolvedPipelineId = preferredMatch?.pipeline_id ?? null;

      const mergedPayload: Record<string, unknown> = { ...updatePayload };
      if (
        modalExternal.cc_value != null &&
        !Number.isNaN(Number(modalExternal.cc_value))
      ) {
        mergedPayload.lead_value = Number(modalExternal.cc_value);
      }

      const { error: updateErr } = await supabase
        .from("leads")
        .update(mergedPayload)
        .eq("id", selectedRow.leadId);
      if (updateErr) throw new Error(updateErr.message);

      const nextLeadValue =
        modalExternal.cc_value != null && !Number.isNaN(Number(modalExternal.cc_value))
          ? Number(modalExternal.cc_value)
          : undefined;

      setRows((prev) =>
        prev.map((r) =>
          r.leadId === selectedRow.leadId
            ? {
                ...r,
                stage: targetStage,
                pipelineId:
                  resolvedPipelineId != null ? String(resolvedPipelineId) : r.pipelineId,
                ...(nextLeadValue !== undefined ? { leadValue: nextLeadValue } : {}),
              }
            : r,
        ),
      );
      setSelectedRow((prev) =>
        prev
          ? {
              ...prev,
              stage: targetStage,
              pipelineId:
                resolvedPipelineId != null ? String(resolvedPipelineId) : prev.pipelineId,
              ...(nextLeadValue !== undefined ? { leadValue: nextLeadValue } : {}),
            }
          : prev,
      );

      if (!preferredMatch) {
        setSyncNotice({
          tone: "warning",
          message: `Stage text updated to "${targetStage}", but no matching stage was found in pipeline_stages — stage_id was cleared. Create a stage with this name to keep the pipeline board aligned.`,
        });
      } else if (pipelineChanged) {
        setSyncNotice({
          tone: "success",
          message: `Synced to "${targetStage}" (stage #${resolvedStageId}). Lead moved to pipeline #${resolvedPipelineId} because the stage lives there.`,
        });
      } else {
        setSyncNotice({
          tone: "success",
          message: `Synced to "${targetStage}" (stage #${resolvedStageId}).`,
        });
      }
    } catch (e) {
      setSyncNotice({
        tone: "error",
        message: e instanceof Error ? e.message : "Failed to update lead stage.",
      });
    } finally {
      setSyncing(false);
    }
  }, [selectedRow, modalExternal, supabase]);

  return (
    <div style={{ fontFamily: T.font, padding: 0, animation: "fadeIn 0.3s ease-out" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ maxWidth: 640 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 800,
              color: "#233217",
              letterSpacing: "-0.01em",
            }}
          >
            Match Local Leads to Deal Tracker
          </h2>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 13,
              color: T.textMuted,
              fontWeight: 500,
              lineHeight: 1.55,
            }}
          >
            Leads where <code>policy_id</code> is set are shown below. Open a row to match our
            local <code>policy_id</code> against <code>deal_tracker.policy_number</code> in the
            external Supabase and compare the current stage with the GHL stage before syncing.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              void handleCompareAllAndPreview();
            }}
            disabled={loading || rows.length === 0 || externalLoading || comparingAll}
            title={
              rows.length === 0
                ? "Load leads first"
                : "Compare every lead against Deal Tracker, then preview and sync all mismatches in one go"
            }
            style={{
              height: 40,
              padding: "0 18px",
              borderRadius: 12,
              border: "none",
              background:
                loading || rows.length === 0 || externalLoading || comparingAll
                  ? "#6b7b52"
                  : "#233217",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: T.font,
              cursor:
                loading || rows.length === 0 || externalLoading || comparingAll
                  ? "not-allowed"
                  : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 14px rgba(35, 50, 23, 0.25)",
              transition: "all 0.15s ease-in-out",
            }}
          >
            {comparingAll || externalLoading ? (
              <LoadingSpinner size={14} />
            ) : (
              <RefreshCw size={14} />
            )}
            {comparingAll || externalLoading
              ? compareProgress && compareProgress.total > 0
                ? `Comparing leads… ${compareProgress.done}/${compareProgress.total}`
                : "Comparing all leads…"
              : "Compare all & preview sync"}
          </button>
          <button
            type="button"
            onClick={selectAllMismatched}
            disabled={!externalLoaded || syncableRowsWithStatus.length === 0}
            title={
              !externalLoaded
                ? "Run comparison first to find mismatched leads"
                : syncableRowsWithStatus.length === 0
                  ? "No mismatched leads to bulk-sync"
                  : undefined
            }
            style={{
              height: 40,
              padding: "0 16px",
              borderRadius: 12,
              border: `1px solid ${T.border}`,
              background: T.pageBg,
              color: T.textDark,
              fontSize: 13,
              fontWeight: 700,
              fontFamily: T.font,
              cursor:
                !externalLoaded || syncableRowsWithStatus.length === 0
                  ? "not-allowed"
                  : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              opacity: !externalLoaded || syncableRowsWithStatus.length === 0 ? 0.55 : 1,
              transition: "all 0.15s ease-in-out",
            }}
          >
            <ListChecks size={16} />
            Select all mismatched
            {externalLoaded && syncableRowsWithStatus.length > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 20,
                  height: 20,
                  padding: "0 6px",
                  borderRadius: 999,
                  background: "#d97706",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {syncableRowsWithStatus.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              void runComparison();
            }}
            disabled={externalLoading || loading || rows.length === 0}
            style={{
              height: 40,
              padding: "0 18px",
              borderRadius: 12,
              border: `1px solid ${T.border}`,
              background: T.pageBg,
              color: T.textDark,
              fontSize: 13,
              fontWeight: 700,
              fontFamily: T.font,
              cursor:
                externalLoading || loading || rows.length === 0 ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              opacity: externalLoading || loading || rows.length === 0 ? 0.6 : 1,
              transition: "all 0.15s ease-in-out",
            }}
          >
            <Database size={16} />
            {externalLoading ? "Checking Deal Tracker…" : "Run comparison"}
          </button>
          <button
            type="button"
            onClick={() => {
              void loadRows();
            }}
            disabled={loading}
            style={{
              height: 40,
              padding: "0 18px",
              borderRadius: 12,
              border: "none",
              background: "#233217",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: T.font,
              cursor: loading ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              opacity: loading ? 0.6 : 1,
              boxShadow: "0 4px 14px rgba(35, 50, 23, 0.25)",
              transition: "all 0.15s ease-in-out",
            }}
          >
            <RefreshCw size={16} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            Refresh leads
          </button>
        </div>
      </div>

      {loadError && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 12,
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {loadError}
        </div>
      )}

      {externalError && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 12,
            background: "#fef3c7",
            color: "#92400e",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Deal Tracker lookup failed: {externalError}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 20,
          marginBottom: 24,
        }}
      >
        <StatCard
          label="Leads with policy_id"
          value={stats.total.toLocaleString()}
          icon={<Link2 size={18} />}
          tone="#233217"
        />
        <StatCard
          label="Stage in sync"
          value={externalLoaded ? stats.matched.toLocaleString() : "—"}
          icon={<CheckCircle2 size={18} />}
          tone="#16a34a"
        />
        <StatCard
          label="Stage differs"
          value={externalLoaded ? stats.mismatch.toLocaleString() : "—"}
          icon={<ArrowRight size={18} />}
          tone="#d97706"
        />
        <StatCard
          label="No external match"
          value={externalLoaded ? stats.missing.toLocaleString() : "—"}
          icon={<CircleSlash size={18} />}
          tone="#dc2626"
        />
      </div>

      <div
        style={{
          width: "100%",
          background: T.cardBg,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          padding: "14px 20px",
          boxShadow: T.shadowSm,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Status Filter Buttons - Primary */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {(
              [
                { key: "all", label: "All Status", tone: "#233217" },
                { key: "matched", label: "In sync", tone: STATUS_COLORS.matched.color },
                { key: "mismatch", label: "Differs", tone: STATUS_COLORS.mismatch.color },
                { key: "missing", label: "Missing", tone: STATUS_COLORS.missing.color },
                { key: "pending", label: "Not checked", tone: STATUS_COLORS.pending.color },
              ] as const
            ).map((opt) => {
              const active = statusFilter === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setStatusFilter(opt.key)}
                  style={{
                    height: 38,
                    padding: "0 14px",
                    borderRadius: 10,
                    border: active ? `2px solid ${opt.tone}` : `1px solid ${T.border}`,
                    background: active ? `${opt.tone}15` : T.pageBg,
                    color: active ? opt.tone : T.textMid,
                    fontSize: 13,
                    fontWeight: active ? 800 : 600,
                    cursor: "pointer",
                    fontFamily: T.font,
                    transition: "all 0.15s ease-in-out",
                    boxShadow: active ? `0 2px 8px ${opt.tone}30` : "none",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          
          {/* Divider */}
          <div style={{ width: 1, height: 28, backgroundColor: T.border, margin: "0 4px" }} />
          
          {/* Pipeline Filter - Secondary */}
          <select
            value={pipelineFilter}
            onChange={(e) => {
              setPipelineFilter(e.target.value);
              setStageFilter("all");
            }}
            style={{
              height: 38,
              padding: "0 14px",
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 500,
              color: T.textDark,
              background: T.cardBg,
              outline: "none",
              cursor: "pointer",
              fontFamily: T.font,
            }}
          >
            <option value="all">All Pipelines</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          
          {/* Stage Filter - Secondary */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            style={{
              height: 38,
              padding: "0 14px",
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 500,
              color: T.textDark,
              background: T.cardBg,
              outline: "none",
              cursor: "pointer",
              fontFamily: T.font,
            }}
          >
            <option value="all">All Stages</option>
            {stages
              .filter((s) => pipelineFilter === "all" || String(s.pipeline_id) === pipelineFilter)
              .map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
          </select>
          
          {/* Divider */}
          <div style={{ width: 1, height: 28, backgroundColor: T.border, margin: "0 4px" }} />
          
          {/* Search */}
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 12,
                pointerEvents: "none",
                zIndex: 1,
                color: T.textMuted,
              }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads..."
              style={{
                height: 38,
                minWidth: 200,
                paddingLeft: 38,
                paddingRight: 14,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                fontSize: 14,
                color: T.textDark,
                background: T.pageBg,
                outline: "none",
                fontFamily: T.font,
                transition: "all 0.15s ease-in-out",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#233217";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(35, 50, 23, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = T.border;
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>
        </div>
      </div>

      {selectedKeys.size > 0 && (
        <div
          style={{
            marginBottom: 14,
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #233217",
            background: "#eef5ee",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            animation: "fadeIn 0.18s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 28,
                height: 28,
                padding: "0 10px",
                borderRadius: 999,
                background: "#233217",
                color: "#fff",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {selectedKeys.size}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#233217" }}>
              {selectedKeys.size === 1 ? "lead selected" : "leads selected"}
            </span>
            <button
              type="button"
              onClick={clearAllSelection}
              style={{
                background: "none",
                border: "none",
                color: "#233217",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                textDecoration: "underline",
                padding: 0,
              }}
            >
              Clear selection
            </button>
          </div>
          <button
            type="button"
            onClick={openBulkModal}
            style={{
              height: 36,
              padding: "0 18px",
              borderRadius: 10,
              border: "none",
              background: "#233217",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: T.font,
              boxShadow: "0 4px 14px rgba(35, 50, 23, 0.25)",
              transition: "all 0.15s ease-in-out",
            }}
          >
            <RefreshCw size={14} />
            Bulk sync {selectedKeys.size}{" "}
            {selectedKeys.size === 1 ? "lead" : "leads"}
          </button>
        </div>
      )}

      <div
        style={{
          borderRadius: 16,
          border: `1px solid ${T.border}`,
          overflow: "hidden",
          backgroundColor: T.cardBg,
        }}
      >
        {loading ? (
          <div
            style={{
              padding: "80px 40px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
            }}
          >
            <LoadingSpinner size={48} label="Loading leads with policies…" />
          </div>
        ) : paginated.length === 0 ? (
          <div style={{ padding: "60px 40px", textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.textMuted, marginBottom: 8 }}>
              {rows.length === 0 ? "No leads with a policy_id" : "No matching leads"}
            </div>
            <div style={{ fontSize: 14, color: T.textMid }}>
              {rows.length === 0
                ? "Leads whose leads.policy_id column is populated will appear here."
                : "Try adjusting your search or filter criteria."}
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                borderBottom: `1px solid ${T.border}`,
                overflow: "hidden",
                backgroundColor: T.cardBg,
              }}
            >
              <ShadcnTable>
                <TableHeader style={{ backgroundColor: "#233217" }}>
                  <TableRow style={{ borderBottom: "none" }} className="hover:bg-transparent">
                    <TableHead
                      style={{
                        color: "#ffffff",
                        fontWeight: 700,
                        fontSize: 12,
                        letterSpacing: "0.3px",
                        padding: "16px 14px 16px 20px",
                        whiteSpace: "nowrap",
                        textAlign: "left",
                        width: 40,
                      }}
                    >
                      <TriStateCheckbox
                        checked={allOnPageSelected}
                        indeterminate={someOnPageSelected}
                        disabled={syncableKeysOnPage.length === 0}
                        onChange={(next) => {
                          if (next) selectAllOnPage();
                          else clearPageSelection();
                        }}
                        title={
                          syncableKeysOnPage.length === 0
                            ? "No syncable leads on this page"
                            : allOnPageSelected
                              ? "Clear page selection"
                              : "Select all syncable on page"
                        }
                      />
                    </TableHead>
                    {[
                      { label: "S.No", align: "left" as const },
                      { label: "Lead", align: "left" as const },
                      { label: "Phone", align: "left" as const },
                      { label: "Policy #", align: "left" as const },
                      { label: "Carrier", align: "left" as const },
                      { label: "Local Stage", align: "left" as const },
                      { label: "GHL Stage", align: "left" as const },
                      { label: "Status", align: "left" as const },
                      { label: "Action", align: "right" as const },
                    ].map(({ label, align }) => (
                      <TableHead
                        key={label}
                        style={{
                          color: "#ffffff",
                          fontWeight: 700,
                          fontSize: 12,
                          letterSpacing: "0.3px",
                          padding: "16px 20px",
                          whiteSpace: "nowrap",
                          textAlign: align,
                        }}
                      >
                        {label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(({ row, external, status }, i) => {
                    const key = `${row.leadId}:${row.policyNumber}`;
                    const isSelected = selectedKeys.has(key);
                    const isSelectable =
                      status.tone === "mismatch" &&
                      !!external &&
                      !!(external.ghl_stage && external.ghl_stage.trim());
                    return (
                    <TableRow
                      key={key}
                      style={{
                        borderBottom: `1px solid ${T.border}`,
                        backgroundColor: isSelected ? "#eef5ee" : undefined,
                      }}
                      className="hover:bg-muted/30 transition-all duration-150"
                    >
                      <TableCell style={{ padding: "14px 14px 14px 20px", width: 40 }}>
                        <TriStateCheckbox
                          checked={isSelected}
                          disabled={!isSelectable}
                          onChange={() => toggleSelected(key)}
                          title={
                            !isSelectable
                              ? status.tone === "matched"
                                ? "Already in sync"
                                : status.tone === "missing"
                                  ? "No matching record in Deal Tracker"
                                  : status.tone === "pending"
                                    ? "Run comparison first"
                                    : "Nothing to sync"
                              : isSelected
                                ? "Unselect lead"
                                : "Select lead for bulk sync"
                          }
                        />
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.textMuted }}>
                          {(page - 1) * ITEMS_PER_PAGE + i + 1}
                        </span>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: T.textDark }}>
                            {row.fullName}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: T.textMuted,
                              fontWeight: 500,
                              fontFamily: "monospace",
                            }}
                          >
                            {row.leadDisplayId}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        <span style={{ fontSize: 12, color: T.textMid, fontWeight: 500 }}>
                          {formatPhone(row.phone) || "—"}
                        </span>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#233217",
                            fontFamily: "monospace",
                          }}
                        >
                          {row.policyNumber}
                        </span>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        {row.carrier ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "4px 10px",
                              borderRadius: 6,
                              backgroundColor: "#DCEBDC",
                              color: "#233217",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {row.carrier}
                          </span>
                        ) : (
                          <span style={{ color: T.textMuted, fontSize: 13 }}>—</span>
                        )}
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        {row.stage ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "4px 10px",
                              borderRadius: 6,
                              backgroundColor: "#eef5ee",
                              color: "#233217",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {row.stage}
                          </span>
                        ) : (
                          <span style={{ color: T.textMuted, fontSize: 13 }}>—</span>
                        )}
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        {externalLoaded ? (
                          external?.ghl_stage ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "4px 10px",
                                borderRadius: 6,
                                backgroundColor: "#f0f9ff",
                                color: "#0369a1",
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              {external.ghl_stage}
                            </span>
                          ) : (
                            <span style={{ color: T.textMuted, fontSize: 13 }}>—</span>
                          )
                        ) : (
                          <span style={{ color: T.textMuted, fontSize: 12, fontStyle: "italic" }}>
                            Run comparison
                          </span>
                        )}
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        <StatusPill status={status} />
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => {
                            void openMapping(row);
                          }}
                          style={{
                            height: 32,
                            padding: "0 14px",
                            borderRadius: 8,
                            border: "1px solid #233217",
                            background: "#233217",
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontFamily: T.font,
                            transition: "all 0.15s ease-in-out",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = "#3b5229";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = "#233217";
                          }}
                        >
                          View mapping
                          <ArrowRight size={14} />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                  })}
                </TableBody>
              </ShadcnTable>
            </div>

            <div
              style={{
                backgroundColor: T.cardBg,
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: `1px solid ${T.border}`,
              }}
            >
              <span style={{ fontSize: 13, color: "#233217", fontWeight: 500 }}>
                Showing {paginated.length} of {filtered.length.toLocaleString()} leads
              </span>
              {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{
                      height: 32,
                      width: 32,
                      borderRadius: 8,
                      border: `1px solid ${T.border}`,
                      background: T.cardBg,
                      color: page === 1 ? T.textMuted : T.textDark,
                      cursor: page === 1 ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <span style={{ fontSize: 13, color: T.textMid, fontWeight: 600 }}>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    style={{
                      height: 32,
                      width: 32,
                      borderRadius: 8,
                      border: `1px solid ${T.border}`,
                      background: T.cardBg,
                      color: page === totalPages ? T.textMuted : T.textDark,
                      cursor: page === totalPages ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {selectedRow && (
        <MappingModal
          row={selectedRow}
          external={modalExternal}
          loading={modalLoading}
          error={modalError}
          status={modalStatus}
          confirmed={mappingConfirmed}
          onConfirmChange={setMappingConfirmed}
          onClose={closeMapping}
          onSync={handleSync}
          syncing={syncing}
          syncNotice={syncNotice}
        />
      )}

      {bulkOpen && (
        <CrmSyncBulkPreviewModal
          previewRows={syncBulkPreviewRows}
          setPreviewRows={setSyncBulkPreviewRows}
          previewPage={syncBulkPreviewPage}
          setPreviewPage={setSyncBulkPreviewPage}
          previewFilter={syncBulkPreviewFilter}
          setPreviewFilter={setSyncBulkPreviewFilter}
          running={bulkRunning}
          finished={bulkFinished}
          progress={bulkProgress}
          results={bulkResults}
          onApply={runBulkSync}
          onClose={closeBulkModal}
        />
      )}
    </div>
  );
}

function TriStateCheckbox({
  checked,
  indeterminate = false,
  disabled = false,
  onChange,
  title,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  title?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.currentTarget.checked)}
      onClick={(e) => e.stopPropagation()}
      title={title}
      style={{
        width: 16,
        height: 16,
        accentColor: "#233217",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        margin: 0,
      }}
    />
  );
}

function MappingModal({
  row,
  external,
  loading,
  error,
  status,
  confirmed,
  onConfirmChange,
  onClose,
  onSync,
  syncing,
  syncNotice,
}: {
  row: LeadPolicyRow;
  external: DealTrackerRow | null;
  loading: boolean;
  error: string | null;
  status: ExternalStatus | null;
  confirmed: boolean;
  onConfirmChange: (value: boolean) => void;
  onClose: () => void;
  onSync: () => void;
  syncing: boolean;
  syncNotice: { tone: "success" | "warning" | "error" | "info"; message: string } | null;
}) {
  const canSync =
    !loading &&
    !error &&
    external !== null &&
    !!(external.ghl_stage && external.ghl_stage.trim()) &&
    confirmed &&
    !syncing;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 13, 0.55)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "fadeIn 0.18s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 840,
          maxHeight: "90vh",
          overflow: "auto",
          backgroundColor: "#fff",
          borderRadius: 20,
          boxShadow: "0 28px 80px rgba(0,0,0,0.24)",
          animation: "fadeInDown 0.22s ease",
          fontFamily: T.font,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "24px 28px 16px",
            borderBottom: `1px solid ${T.borderLight}`,
            gap: 16,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                color: T.textMuted,
                marginBottom: 6,
              }}
            >
              CRM Sync · Mapping preview
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                color: "#233217",
                letterSpacing: "-0.01em",
              }}
            >
              {row.fullName}
            </h3>
            <div
              style={{
                marginTop: 6,
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#233217",
                  fontFamily: "monospace",
                  backgroundColor: "#eef5ee",
                  padding: "3px 8px",
                  borderRadius: 6,
                }}
              >
                {row.policyNumber}
              </span>
              {row.carrier && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#233217",
                    backgroundColor: "#DCEBDC",
                    padding: "3px 8px",
                    borderRadius: 6,
                  }}
                >
                  {row.carrier}
                </span>
              )}
              {status && <StatusPill status={status} />}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: `1px solid ${T.border}`,
              background: T.pageBg,
              color: T.textMid,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              transition: "all 0.15s ease-in-out",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "#eef5ee";
              (e.currentTarget as HTMLElement).style.color = "#233217";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = T.pageBg;
              (e.currentTarget as HTMLElement).style.color = T.textMid;
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "20px 28px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
          {error && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                background: "#fef2f2",
                color: "#b91c1c",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ padding: "48px 0" }}>
              <LoadingSpinner size={40} label="Fetching external record…" />
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  gap: 16,
                  alignItems: "stretch",
                }}
              >
                <SidePanel
                  title="Insurvas CRM"
                  subtitle="Local lead (leads.policy_id)"
                  accent="#233217"
                  rows={[
                    { label: "Lead name", value: row.fullName },
                    { label: "Lead ID", value: row.leadDisplayId, mono: true },
                    { label: "Phone", value: formatPhone(row.phone) || "—" },
                    { label: "Policy ID", value: row.policyNumber, mono: true },
                    { label: "Carrier", value: row.carrier || "—" },
                    { label: "Product type", value: row.productType || "—" },
                    { label: "Lead value", value: formatMoney(row.leadValue) },
                    { label: "Lead source", value: row.leadSource || "—" },
                    { label: "Submission", value: formatDate(row.submissionDate) },
                    { label: "Current stage", value: row.stage || "—", emphasis: true },
                  ]}
                />

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 4px",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "#233217",
                      color: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 6px 18px rgba(35, 50, 23, 0.25)",
                    }}
                  >
                    <ArrowRight size={18} />
                  </div>
                </div>

                <SidePanel
                  title="Deal Tracker"
                  subtitle="External Supabase"
                  accent="#0369a1"
                  empty={!external ? "No deal_tracker row found for this policy number." : null}
                  rows={
                    external
                      ? [
                          { label: "GHL name", value: external.ghl_name || external.name || "—" },
                          { label: "Deal name", value: external.name || "—" },
                          { label: "Phone", value: formatPhone(external.phone_number) || "—" },
                          { label: "Policy number", value: external.policy_number, mono: true },
                          { label: "Carrier", value: external.carrier || "—" },
                          { label: "Policy type", value: external.policy_type || "—" },
                          { label: "Policy status", value: external.policy_status || "—" },
                          { label: "Sales agent", value: external.sales_agent || "—" },
                          { label: "CC value", value: formatMoney(external.cc_value) },
                          { label: "Effective", value: formatDate(external.effective_date) },
                          {
                            label: "GHL stage",
                            value: external.ghl_stage || "—",
                            emphasis: true,
                          },
                        ]
                      : []
                  }
                />
              </div>

              {external && (
                <div
                  style={{
                    border: `1px solid ${T.border}`,
                    borderRadius: 14,
                    background: "#fafdf8",
                    padding: 18,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                      color: "#233217",
                      marginBottom: 12,
                    }}
                  >
                    Proposed field mapping
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <MappingRow
                      leftLabel="Lead name (local)"
                      leftValue={row.fullName}
                      rightLabel="GHL name (external)"
                      rightValue={external.ghl_name || external.name || "—"}
                      match={
                        !!external.ghl_name &&
                        external.ghl_name.trim().toLowerCase() ===
                          row.fullName.trim().toLowerCase()
                      }
                    />
                    <MappingRow
                      leftLabel="Current stage (local)"
                      leftValue={row.stage || "—"}
                      rightLabel="GHL stage (external)"
                      rightValue={external.ghl_stage || "—"}
                      match={
                        !!external.ghl_stage &&
                        !!row.stage &&
                        external.ghl_stage.trim().toLowerCase() ===
                          row.stage.trim().toLowerCase()
                      }
                      highlight
                    />
                    <MappingRow
                      leftLabel="Lead value (local)"
                      leftValue={formatMoney(row.leadValue)}
                      rightLabel="CC value (external)"
                      rightValue={formatMoney(external.cc_value)}
                      match={
                        row.leadValue != null &&
                        external.cc_value != null &&
                        Math.abs(Number(row.leadValue) - Number(external.cc_value)) < 0.005
                      }
                      highlight
                    />
                    <MappingRow
                      leftLabel="leads.policy_id (local)"
                      leftValue={row.policyNumber}
                      rightLabel="deal_tracker.policy_number"
                      rightValue={external.policy_number}
                      match
                    />
                  </div>
                </div>
              )}

              {external && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "14px 16px",
                    border: `1px solid ${T.border}`,
                    borderRadius: 12,
                    cursor: "pointer",
                    background: confirmed ? "#eef5ee" : T.cardBg,
                    transition: "background-color 0.15s ease-in-out",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => onConfirmChange(e.target.checked)}
                    style={{
                      width: 18,
                      height: 18,
                      accentColor: "#233217",
                      marginTop: 2,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#233217" }}>
                      I&rsquo;ve reviewed the mapping above
                    </span>
                    <span style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>
                      Confirming will enable the <strong>Sync stage</strong> button. On sync we
                      will update <code>leads.stage</code> (and <code>stage_id</code> /{" "}
                      <code>pipeline_id</code> when a matching <code>pipeline_stages</code> row
                      exists) for this lead.
                    </span>
                  </div>
                </label>
              )}

              {syncNotice && (
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: 12,
                    background:
                      syncNotice.tone === "success"
                        ? "#dcfce7"
                        : syncNotice.tone === "warning"
                          ? "#fef3c7"
                          : syncNotice.tone === "error"
                            ? "#fee2e2"
                            : "#eff6ff",
                    color:
                      syncNotice.tone === "success"
                        ? "#166534"
                        : syncNotice.tone === "warning"
                          ? "#92400e"
                          : syncNotice.tone === "error"
                            ? "#991b1b"
                            : "#1d4ed8",
                    fontSize: 13,
                    fontWeight: 600,
                    lineHeight: 1.5,
                  }}
                >
                  {syncNotice.message}
                </div>
              )}
            </>
          )}
        </div>

        <div
          style={{
            padding: "16px 28px 24px",
            borderTop: `1px solid ${T.borderLight}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 40,
              padding: "0 18px",
              borderRadius: 12,
              border: `1px solid ${T.border}`,
              background: T.pageBg,
              color: T.textDark,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: T.font,
              transition: "all 0.15s ease-in-out",
            }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={onSync}
            disabled={!canSync}
            title={
              !external
                ? "No matching record in Deal Tracker"
                : !external.ghl_stage || !external.ghl_stage.trim()
                  ? "Deal Tracker record has no ghl_stage set"
                  : !confirmed
                    ? "Confirm the mapping to enable sync"
                    : undefined
            }
            style={{
              height: 40,
              padding: "0 22px",
              borderRadius: 12,
              border: "none",
              background: canSync ? "#233217" : "#a8b6a1",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: canSync ? "pointer" : "not-allowed",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: T.font,
              boxShadow: canSync ? "0 4px 14px rgba(35, 50, 23, 0.3)" : "none",
              transition: "all 0.15s ease-in-out",
            }}
          >
            <RefreshCw size={16} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
            {syncing ? "Syncing…" : "Sync stage"}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

function SidePanel({
  title,
  subtitle,
  accent,
  rows,
  empty,
}: {
  title: string;
  subtitle: string;
  accent: string;
  rows: { label: string; value: string; mono?: boolean; emphasis?: boolean }[];
  empty?: string | null;
}) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${T.border}`,
        background: T.cardBg,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          backgroundColor: `${accent}10`,
          borderBottom: `1px solid ${T.borderLight}`,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 800, color: accent, letterSpacing: "0.4px" }}>
          {title.toUpperCase()}
        </span>
        <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{subtitle}</span>
      </div>
      <div style={{ padding: "8px 4px", flex: 1 }}>
        {empty && (
          <div
            style={{
              padding: "20px 16px",
              fontSize: 12,
              color: T.textMuted,
              fontStyle: "italic",
              textAlign: "center",
            }}
          >
            {empty}
          </div>
        )}
        {rows.map((r) => (
          <div
            key={r.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              gap: 8,
              borderRadius: 8,
              minHeight: 36,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.2px" }}>
              {r.label}
            </span>
            <span
              style={{
                fontSize: r.emphasis ? 13 : 12,
                fontWeight: r.emphasis ? 800 : 600,
                color: r.emphasis ? "#233217" : T.textDark,
                fontFamily: r.mono ? "monospace" : T.font,
                textAlign: "right",
                wordBreak: "break-word",
                maxWidth: "65%",
              }}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MappingRow({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  match,
  highlight,
}: {
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
  match: boolean;
  highlight?: boolean;
}) {
  const tone = match ? "#16a34a" : "#d97706";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr auto",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 10,
        background: highlight ? "#fff" : "transparent",
        border: highlight ? `1px dashed ${T.border}` : "1px solid transparent",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: "0.3px", textTransform: "uppercase" }}>
          {leftLabel}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: T.textDark,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {leftValue}
        </span>
      </div>
      <ArrowRight size={14} color={T.textMuted} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: "0.3px", textTransform: "uppercase" }}>
          {rightLabel}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: T.textDark,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {rightValue}
        </span>
      </div>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "3px 8px",
          borderRadius: 999,
          backgroundColor: `${tone}18`,
          color: tone,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.3px",
        }}
      >
        {match ? "MATCH" : "DIFFERS"}
      </span>
    </div>
  );
}

type BulkResult = {
  key: string;
  leadId: string;
  leadName: string;
  policyNumber: string;
  fromStage: string;
  toStage: string;
  outcome: "updated" | "pipeline_changed" | "no_stage_row" | "skipped" | "error";
  message?: string;
};

/** Editable row for CRM Sync bulk preview (stage + lead_value from Deal Tracker cc_value). */
type CrmSyncBulkPreviewRow = {
  key: string;
  leadId: string;
  leadName: string;
  policyNumber: string;
  pipelineId: string | null;
  stageCrm: string;
  stageTarget: string;
  leadValueCrm: string;
  leadValueTarget: string;
};

function crmSyncPreviewRowHasDiff(row: CrmSyncBulkPreviewRow): boolean {
  const stageDiff =
    (row.stageCrm || "").trim().toLowerCase() !== (row.stageTarget || "").trim().toLowerCase();
  const parseN = (s: string) => {
    const n = parseFloat(String(s ?? "").replace(/,/g, "").trim());
    return Number.isNaN(n) ? null : n;
  };
  const a = parseN(row.leadValueCrm);
  const b = parseN(row.leadValueTarget);
  const valDiff =
    (a === null) !== (b === null) || (a !== null && b !== null && Math.abs(a - b) > 0.005);
  return stageDiff || valDiff;
}

function CrmSyncBulkPreviewModal({
  previewRows,
  setPreviewRows,
  previewPage,
  setPreviewPage,
  previewFilter,
  setPreviewFilter,
  running,
  finished,
  progress,
  results,
  onApply,
  onClose,
}: {
  previewRows: CrmSyncBulkPreviewRow[];
  setPreviewRows: React.Dispatch<React.SetStateAction<CrmSyncBulkPreviewRow[]>>;
  previewPage: number;
  setPreviewPage: React.Dispatch<React.SetStateAction<number>>;
  previewFilter: "all" | "different";
  setPreviewFilter: React.Dispatch<React.SetStateAction<"all" | "different">>;
  running: boolean;
  finished: boolean;
  progress: { done: number; total: number };
  results: BulkResult[];
  onApply: () => void;
  onClose: () => void;
}) {
  const percent =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  const summary = useMemo(() => {
    const s = { updated: 0, pipeline: 0, warned: 0, skipped: 0, errored: 0 };
    for (const r of results) {
      if (r.outcome === "updated") s.updated += 1;
      else if (r.outcome === "pipeline_changed") s.pipeline += 1;
      else if (r.outcome === "no_stage_row") s.warned += 1;
      else if (r.outcome === "skipped") s.skipped += 1;
      else if (r.outcome === "error") s.errored += 1;
    }
    return s;
  }, [results]);

  const diffCount = useMemo(
    () => previewRows.filter((r) => crmSyncPreviewRowHasDiff(r)).length,
    [previewRows],
  );

  const viewRows = useMemo(() => {
    if (previewFilter === "all") return previewRows;
    return previewRows.filter((r) => crmSyncPreviewRowHasDiff(r));
  }, [previewRows, previewFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(viewRows.length / BULK_PREVIEW_ITEMS_PER_PAGE),
  );
  const paginatedRows = viewRows.slice(
    (previewPage - 1) * BULK_PREVIEW_ITEMS_PER_PAGE,
    previewPage * BULK_PREVIEW_ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setPreviewPage((p) => Math.min(p, totalPages));
  }, [totalPages, previewFilter, setPreviewPage]);

  const removePreviewRow = (key: string) => {
    setPreviewRows((prev) => prev.filter((r) => r.key !== key));
  };

  const updatePreviewRow = (
    key: string,
    patch: Partial<Pick<CrmSyncBulkPreviewRow, "stageTarget" | "leadValueTarget">>,
  ) => {
    setPreviewRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  };

  return (
    <div
      onClick={running ? undefined : onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 13, 0.55)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "fadeIn 0.18s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 1500,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#fff",
          borderRadius: 20,
          boxShadow: "0 28px 80px rgba(0,0,0,0.24)",
          animation: "fadeInDown 0.22s ease",
          fontFamily: T.font,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "22px 28px 16px",
            borderBottom: `1px solid ${T.borderLight}`,
            gap: 16,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                color: T.textMuted,
                marginBottom: 6,
              }}
            >
              CRM Sync · Bulk preview
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 800,
                color: "#233217",
                letterSpacing: "-0.01em",
              }}
            >
              {finished
                ? "Bulk sync complete"
                : running
                  ? "Saving to CRM…"
                  : previewRows.length === 0
                    ? "Nothing to sync"
                    : `Review ${previewRows.length.toLocaleString()} ${
                        previewRows.length === 1 ? "lead" : "leads"
                      }`}
            </h3>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: T.textMuted,
                fontWeight: 500,
                lineHeight: 1.5,
              }}
            >
              {finished
                ? "Review the per-lead outcomes below."
                : running
                  ? "Updating leads one at a time. Keep this tab open."
                  : previewRows.length === 0
                    ? "No leads in this batch."
                    : "Edit target stage and lead value (from Deal Tracker CC value) before saving. Different tab shows rows where stage or lead value differs."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            title={running ? "Wait for sync to finish" : "Close"}
            style={{
              border: "none",
              background: "transparent",
              padding: 6,
              borderRadius: 8,
              cursor: running ? "not-allowed" : "pointer",
              color: T.textMuted,
              opacity: running ? 0.4 : 1,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {(running || finished) && (
          <div
            style={{
              padding: "16px 28px",
              borderBottom: `1px solid ${T.borderLight}`,
              background: "#f9faf6",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: "#233217" }}>
                {finished
                  ? `Completed ${progress.done} of ${progress.total}`
                  : `Processing ${progress.done} of ${progress.total}`}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.textMid }}>{percent}%</span>
            </div>
            <div
              style={{
                width: "100%",
                height: 8,
                borderRadius: 999,
                background: T.borderLight,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${percent}%`,
                  background: finished ? STATUS_COLORS.matched.color : "#233217",
                  transition: "width 0.2s ease-out",
                }}
              />
            </div>
            {finished && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginTop: 14,
                }}
              >
                <SummaryChip
                  tone={STATUS_COLORS.matched.color}
                  label="Updated"
                  count={summary.updated}
                />
                {summary.pipeline > 0 && (
                  <SummaryChip tone="#2563eb" label="Moved pipeline" count={summary.pipeline} />
                )}
                {summary.warned > 0 && (
                  <SummaryChip tone="#d97706" label="No stage row" count={summary.warned} />
                )}
                {summary.skipped > 0 && (
                  <SummaryChip tone={T.textMuted} label="Skipped" count={summary.skipped} />
                )}
                {summary.errored > 0 && (
                  <SummaryChip
                    tone={STATUS_COLORS.mismatch.color}
                    label="Errors"
                    count={summary.errored}
                  />
                )}
              </div>
            )}
          </div>
        )}

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "16px 28px 20px",
          }}
        >
          {!running && !finished && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {previewRows.length === 0 ? (
                <div
                  style={{
                    padding: "28px 24px",
                    textAlign: "center",
                    color: T.textMuted,
                    fontSize: 13,
                  }}
                >
                  No leads in preview. Close and select leads again.
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {(
                      [
                        { key: "all" as const, label: `All (${previewRows.length})` },
                        {
                          key: "different" as const,
                          label: `Different (${diffCount})`,
                        },
                      ]
                    ).map((tab) => {
                      const active = previewFilter === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => {
                            setPreviewFilter(tab.key);
                            setPreviewPage(1);
                          }}
                          style={{
                            height: 32,
                            padding: "0 12px",
                            borderRadius: 8,
                            border: active ? "2px solid #233217" : `1px solid ${T.border}`,
                            background: active ? "#eef5ee" : T.cardBg,
                            color: active ? "#233217" : T.textDark,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {viewRows.length === 0 ? (
                    <div style={{ padding: 24, textAlign: "center", color: T.textMuted }}>
                      No rows match the Different filter.
                    </div>
                  ) : (
                    <>
                      <ShadcnTable>
                        <TableHeader>
                          <TableRow>
                            <TableHead style={{ width: 72 }}>Action</TableHead>
                            <TableHead>Lead</TableHead>
                            <TableHead>Policy ID</TableHead>
                            <TableHead>Stage (CRM)</TableHead>
                            <TableHead>Stage → save</TableHead>
                            <TableHead>Lead value (CRM)</TableHead>
                            <TableHead>Lead value → save (CC)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedRows.map((row) => (
                            <TableRow key={row.key}>
                              <TableCell>
                                <button
                                  type="button"
                                  onClick={() => removePreviewRow(row.key)}
                                  style={{
                                    height: 28,
                                    padding: "0 8px",
                                    borderRadius: 6,
                                    border: `1px solid #fecaca`,
                                    background: "#fff1f2",
                                    color: "#b91c1c",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  Remove
                                </button>
                              </TableCell>
                              <TableCell style={{ fontWeight: 700 }}>{row.leadName}</TableCell>
                              <TableCell style={{ fontFamily: "monospace", fontSize: 12 }}>
                                {row.policyNumber}
                              </TableCell>
                              <TableCell>{row.stageCrm || "—"}</TableCell>
                              <TableCell>
                                <input
                                  value={row.stageTarget}
                                  onChange={(e) =>
                                    updatePreviewRow(row.key, { stageTarget: e.target.value })
                                  }
                                  style={{
                                    width: "100%",
                                    minWidth: 140,
                                    height: 32,
                                    border: `1px solid ${T.border}`,
                                    borderRadius: 8,
                                    padding: "0 8px",
                                    fontSize: 13,
                                  }}
                                />
                              </TableCell>
                              <TableCell>{row.leadValueCrm || "—"}</TableCell>
                              <TableCell>
                                <input
                                  value={row.leadValueTarget}
                                  onChange={(e) =>
                                    updatePreviewRow(row.key, {
                                      leadValueTarget: e.target.value,
                                    })
                                  }
                                  placeholder="CC value"
                                  style={{
                                    width: "100%",
                                    minWidth: 120,
                                    height: 32,
                                    border: `1px solid ${T.border}`,
                                    borderRadius: 8,
                                    padding: "0 8px",
                                    fontSize: 13,
                                    fontFamily: "monospace",
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </ShadcnTable>
                      <div
                        style={{
                          marginTop: 10,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>
                          Showing {(previewPage - 1) * BULK_PREVIEW_ITEMS_PER_PAGE + 1}–
                          {Math.min(
                            previewPage * BULK_PREVIEW_ITEMS_PER_PAGE,
                            viewRows.length,
                          )}{" "}
                          of {viewRows.length}
                        </span>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                            disabled={previewPage <= 1}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 8,
                              border: `1px solid ${T.border}`,
                              cursor: previewPage <= 1 ? "not-allowed" : "pointer",
                              opacity: previewPage <= 1 ? 0.5 : 1,
                            }}
                          >
                            Previous
                          </button>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>
                            Page {previewPage} of {totalPages}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPage((p) => Math.min(totalPages, p + 1))
                            }
                            disabled={previewPage >= totalPages}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 8,
                              border: `1px solid ${T.border}`,
                              cursor: previewPage >= totalPages ? "not-allowed" : "pointer",
                              opacity: previewPage >= totalPages ? 0.5 : 1,
                            }}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {(running || finished) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(finished ? results : previewRows.slice(0, progress.done + 1)).map((item) => {
                const isResult = "outcome" in item;
                const key = isResult
                  ? (item as BulkResult).key
                  : (item as CrmSyncBulkPreviewRow).key;
                if (isResult) {
                  const r = item as BulkResult;
                  return (
                    <BulkResultRow
                      key={key}
                      leadName={r.leadName}
                      policyNumber={r.policyNumber}
                      fromStage={r.fromStage || "—"}
                      toStage={r.toStage || "—"}
                      outcome={r.outcome}
                      message={r.message}
                    />
                  );
                }
                const q = item as CrmSyncBulkPreviewRow;
                return (
                  <BulkRow
                    key={key}
                    leadName={q.leadName || "—"}
                    policyNumber={q.policyNumber}
                    fromStage={q.stageCrm || "—"}
                    toStage={(q.stageTarget || "").trim()}
                    inFlight
                  />
                );
              })}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
            padding: "16px 28px",
            borderTop: `1px solid ${T.borderLight}`,
            background: "#fafaf7",
          }}
        >
          {!running && !finished && (
            <>
              <button
                type="button"
                onClick={onClose}
                style={{
                  height: 36,
                  padding: "0 16px",
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: T.pageBg,
                  color: T.textDark,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: T.font,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onApply}
                disabled={previewRows.length === 0}
                style={{
                  height: 36,
                  padding: "0 18px",
                  borderRadius: 10,
                  border: "none",
                  background: "#233217",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: previewRows.length === 0 ? "not-allowed" : "pointer",
                  fontFamily: T.font,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  opacity: previewRows.length === 0 ? 0.55 : 1,
                }}
              >
                <RefreshCw size={14} />
                Save preview to CRM
              </button>
            </>
          )}
          {running && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <LoadingSpinner size={20} />
              <span style={{ fontSize: 12, fontWeight: 600, color: T.textMid }}>
                Do not close this window…
              </span>
            </div>
          )}
          {finished && (
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 36,
                padding: "0 18px",
                borderRadius: 10,
                border: "none",
                background: "#233217",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: T.font,
              }}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryChip({ tone, label, count }: { tone: string; label: string; count: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: `${tone}15`,
        color: tone,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.3px",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 18,
          height: 18,
          padding: "0 6px",
          borderRadius: 999,
          background: tone,
          color: "#fff",
          fontSize: 10,
          fontWeight: 800,
        }}
      >
        {count}
      </span>
      {label}
    </span>
  );
}

function BulkRow({
  leadName,
  policyNumber,
  fromStage,
  toStage,
  inFlight = false,
}: {
  leadName: string;
  policyNumber: string;
  fromStage: string;
  toStage: string;
  inFlight?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1.5fr) 24px",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 10,
        background: inFlight ? "#f4f8f1" : T.pageBg,
        border: `1px solid ${T.borderLight}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: T.textDark,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {leadName}
        </div>
        <div
          style={{
            fontSize: 11,
            color: T.textMuted,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            marginTop: 2,
          }}
        >
          {policyNumber}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
        }}
      >
        <StageChip label={fromStage} tone={T.textMuted} />
        <ArrowRight size={14} color={T.textMuted} />
        <StageChip label={toStage} tone="#233217" bold />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {inFlight && <LoadingSpinner size={16} />}
      </div>
    </div>
  );
}

function BulkResultRow({
  leadName,
  policyNumber,
  fromStage,
  toStage,
  outcome,
  message,
}: {
  leadName: string;
  policyNumber: string;
  fromStage: string;
  toStage: string;
  outcome: BulkResult["outcome"];
  message?: string;
}) {
  const cfg: { tone: string; label: string; icon: ReactNode } = (() => {
    switch (outcome) {
      case "updated":
        return {
          tone: STATUS_COLORS.matched.color,
          label: "Updated",
          icon: <CheckCircle2 size={14} />,
        };
      case "pipeline_changed":
        return {
          tone: "#2563eb",
          label: "Moved pipeline",
          icon: <ArrowRight size={14} />,
        };
      case "no_stage_row":
        return {
          tone: "#d97706",
          label: "No stage row",
          icon: <AlertTriangle size={14} />,
        };
      case "skipped":
        return {
          tone: T.textMuted,
          label: "Skipped",
          icon: <CircleSlash size={14} />,
        };
      case "error":
      default:
        return {
          tone: STATUS_COLORS.mismatch.color,
          label: "Error",
          icon: <AlertTriangle size={14} />,
        };
    }
  })();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1.5fr) minmax(0, 0.9fr)",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 10,
        background: T.pageBg,
        border: `1px solid ${T.borderLight}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: T.textDark,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {leadName}
        </div>
        <div
          style={{
            fontSize: 11,
            color: T.textMuted,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            marginTop: 2,
          }}
        >
          {policyNumber}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <StageChip label={fromStage} tone={T.textMuted} />
        <ArrowRight size={14} color={T.textMuted} />
        <StageChip label={toStage} tone="#233217" bold />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 9px",
            borderRadius: 999,
            background: `${cfg.tone}18`,
            color: cfg.tone,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.3px",
          }}
        >
          {cfg.icon}
          {cfg.label}
        </span>
        {message && (
          <span
            style={{
              fontSize: 11,
              color: T.textMuted,
              lineHeight: 1.4,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
            title={message}
          >
            {message}
          </span>
        )}
      </div>
    </div>
  );
}

function StageChip({
  label,
  tone,
  bold = false,
}: {
  label: string;
  tone: string;
  bold?: boolean;
}) {
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        background: `${tone}12`,
        color: tone,
        fontSize: 11,
        fontWeight: bold ? 800 : 700,
        maxWidth: 200,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        border: `1px solid ${tone}22`,
      }}
      title={label}
    >
      {label}
    </span>
  );
}

// Policy Attachment & Review Tab Component
function PolicyAttachmentTab() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const normalizeName = useCallback(
    (value: string | null | undefined) =>
      String(value ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase(),
    [],
  );
  const normalizePhoneDigits = useCallback((value: string | null | undefined) => {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
    return digits;
  }, []);
  const tokenizeName = useCallback(
    (value: string | null | undefined) =>
      normalizeName(value)
        .split(" ")
        .map((p) => p.trim())
        .filter(Boolean),
    [normalizeName],
  );
  
  const [leads, setLeads] = useState<LeadPolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  
  // Filters
  const [pipelineFilter, setPipelineFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [policyFilter, setPolicyFilter] = useState<"all" | "has" | "no">("all");
  const [syncRequiredFilter, setSyncRequiredFilter] = useState<"all" | "true" | "false">("all");
  
  // Options for filters
  const [pipelines, setPipelines] = useState<Array<{ id: string; name: string }>>([]);
  const [stages, setStages] = useState<Array<{ id: number; name: string; pipeline_id: number }>>([]);
  
  // Policy attachment modal
  const [selectedLead, setSelectedLead] = useState<LeadPolicyRow | null>(null);
  const [policyNumberInput, setPolicyNumberInput] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachSuccess, setAttachSuccess] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [bulkPreviewOpen, setBulkPreviewOpen] = useState(false);
  const [bulkPreviewRows, setBulkPreviewRows] = useState<BulkPreviewRow[]>([]);
  const [bulkPreviewSaving, setBulkPreviewSaving] = useState(false);
  const [carrierOptions, setCarrierOptions] = useState<string[]>([]);
  const [callCenterOptions, setCallCenterOptions] = useState<string[]>([]);
  const [bulkPreviewPage, setBulkPreviewPage] = useState(1);
  const [bulkPreviewView, setBulkPreviewView] = useState<"all" | "different">("all");
  
  // Load pipelines and stages for filters
  useEffect(() => {
    const fetchOptions = async () => {
      const [{ data: pipelineData }, { data: stageData }] = await Promise.all([
        supabase.from("pipelines").select("id, name").order("name"),
        supabase.from("pipeline_stages").select("id, name, pipeline_id").order("position"),
      ]);
      setPipelines(pipelineData || []);
      setStages(stageData || []);
    };
    fetchOptions();
  }, [supabase]);
  
  // Load leads with pagination to fetch all records
  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      // Keyset pagination on id — avoids PostgREST max-rows + unstable offset when updated_at ties.
      const PAGE_SIZE = 1000;
      const collected: Record<string, unknown>[] = [];
      let cursorId: string | null = null;
      const MAX_ROWS = 50000;

      while (collected.length < MAX_ROWS) {
        let query = supabase
          .from("leads")
          .select(
            "id, lead_unique_id, first_name, last_name, phone, stage, pipeline_id, call_center_id, policy_id, carrier, product_type, monthly_premium, lead_value, lead_source, submission_date, updated_at"
          )
          .eq("is_draft", false)
          .order("id", { ascending: true })
          .limit(PAGE_SIZE);

        if (pipelineFilter !== "all") {
          query = query.eq("pipeline_id", pipelineFilter);
        }

        if (stageFilter !== "all") {
          query = query.eq("stage", stageFilter);
        }

        if (policyFilter === "has") {
          query = query.not("policy_id", "is", null).neq("policy_id", "");
        } else if (policyFilter === "no") {
          query = query.or("policy_id.is.null,policy_id.eq.");
        }

        if (syncRequiredFilter !== "all") {
          query = query.eq("sync_required", syncRequiredFilter === "true");
        }

        if (cursorId !== null) {
          query = query.gt("id", cursorId);
        }

        const { data: leadRows, error } = await query;

        if (error) throw error;

        const batch = (leadRows ?? []) as Record<string, unknown>[];
        if (batch.length === 0) break;
        collected.push(...batch);
        const lastIdRaw = batch[batch.length - 1]?.id;
        cursorId = lastIdRaw != null ? String(lastIdRaw) : null;
        if (!cursorId) break;
        if (batch.length < PAGE_SIZE) break;
      }
      
      const callCenterIds = Array.from(
        new Set(
          collected
            .map((lead) => (lead.call_center_id != null ? String(lead.call_center_id) : ""))
            .filter(Boolean),
        ),
      );
      let callCenterNameById = new Map<string, string>();
      if (callCenterIds.length > 0) {
        const { data: ccRows } = await supabase
          .from("call_centers")
          .select("id, name")
          .in("id", callCenterIds);
        callCenterNameById = new Map(
          ((ccRows ?? []) as Array<{ id: string; name: string | null }>).map((r) => [
            String(r.id),
            String(r.name ?? "").trim(),
          ]),
        );
      }

      const mapped: LeadPolicyRow[] = collected
        .map((lead: Record<string, unknown>) => {
          const leadIdStr = lead?.id != null ? String(lead.id) : "";
          if (!leadIdStr) return null;
          const firstName = String(lead.first_name || "").trim();
          const lastName = String(lead.last_name || "").trim();
          const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Unnamed Lead";
          const displayId = lead.lead_unique_id ? String(lead.lead_unique_id) : leadIdStr;
          const pNum = String(lead?.policy_id ?? "").trim();
          
          return {
            leadId: leadIdStr,
            leadDisplayId: displayId,
            firstName,
            lastName,
            fullName,
            phone: lead.phone != null ? String(lead.phone) : "",
            stage: lead.stage != null ? String(lead.stage) : "",
            pipelineId: lead.pipeline_id != null ? String(lead.pipeline_id) : null,
            callCenterId: lead.call_center_id != null ? String(lead.call_center_id) : null,
            callCenterName:
              lead.call_center_id != null
                ? callCenterNameById.get(String(lead.call_center_id)) ?? null
                : null,
            policyNumber: pNum,
            carrier: lead.carrier != null ? String(lead.carrier) : null,
            productType: lead.product_type != null ? String(lead.product_type) : null,
            monthlyPremium: lead.monthly_premium != null ? String(lead.monthly_premium) : null,
            leadValue: lead.lead_value != null ? Number(lead.lead_value) : null,
            leadSource: lead.lead_source != null ? String(lead.lead_source) : null,
            submissionDate: lead.submission_date != null ? String(lead.submission_date) : null,
            updatedAt: lead.updated_at != null ? String(lead.updated_at) : null,
            syncRequired: lead.sync_required !== false,
          } satisfies LeadPolicyRow;
        })
        .filter((row): row is LeadPolicyRow => row !== null);

      mapped.sort((a, b) => {
        const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
        const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
        if (tb !== ta) return tb - ta;
        return b.leadId.localeCompare(a.leadId);
      });

      setLeads(mapped);
    } catch (err) {
      console.error("Error loading leads:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase, pipelineFilter, stageFilter, policyFilter, syncRequiredFilter]);
  
  useEffect(() => {
    loadLeads();
  }, [loadLeads]);
  
  // Filtered leads
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const numericQ = q.replace(/\D/g, "");
    return leads.filter((row) => {
      if (!q) return true;
      if (row.fullName.toLowerCase().includes(q)) return true;
      if (row.leadDisplayId.toLowerCase().includes(q)) return true;
      if (row.policyNumber.toLowerCase().includes(q)) return true;
      if (numericQ && row.phone.replace(/\D/g, "").includes(numericQ)) return true;
      return false;
    });
  }, [leads, search]);
  
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const noPolicyFiltered = useMemo(
    () => filtered.filter((row) => !row.policyNumber),
    [filtered],
  );
  const noPolicyPaginated = useMemo(
    () => paginated.filter((row) => !row.policyNumber),
    [paginated],
  );
  const noPolicySelectedCount = useMemo(
    () => noPolicyFiltered.filter((row) => selectedLeadIds.has(row.leadId)).length,
    [noPolicyFiltered, selectedLeadIds],
  );
  const pageNoPolicyAllSelected =
    noPolicyPaginated.length > 0 &&
    noPolicyPaginated.every((row) => selectedLeadIds.has(row.leadId));
  const bulkPreviewViewRows = useMemo(() => {
    if (bulkPreviewView === "all") return bulkPreviewRows;
    return bulkPreviewRows.filter((row) => {
      const crmName = normalizeName(row.leadNameCrm);
      const dtName = normalizeName(row.leadNameDt);
      const crmCc = normalizeName(row.callCenterCrm);
      const dtCc = normalizeName(row.callCenterDt);
      return crmName !== dtName || crmCc !== dtCc;
    });
  }, [bulkPreviewRows, bulkPreviewView, normalizeName]);
  const bulkPreviewTotalPages = Math.max(
    1,
    Math.ceil(bulkPreviewViewRows.length / BULK_PREVIEW_ITEMS_PER_PAGE),
  );
  const bulkPreviewPaginatedRows = useMemo(
    () =>
      bulkPreviewViewRows.slice(
        (bulkPreviewPage - 1) * BULK_PREVIEW_ITEMS_PER_PAGE,
        bulkPreviewPage * BULK_PREVIEW_ITEMS_PER_PAGE,
      ),
    [bulkPreviewViewRows, bulkPreviewPage],
  );
  
  useEffect(() => {
    setPage(1);
  }, [search, pipelineFilter, stageFilter, policyFilter]);

  useEffect(() => {
    setSelectedLeadIds(new Set());
    setBulkNotice(null);
  }, [pipelineFilter, stageFilter, search, policyFilter]);

  useEffect(() => {
    if (!bulkPreviewOpen) {
      setBulkPreviewPage(1);
      setBulkPreviewView("all");
      return;
    }
    setBulkPreviewPage((prev) => Math.min(prev, bulkPreviewTotalPages));
  }, [bulkPreviewOpen, bulkPreviewRows.length, bulkPreviewTotalPages]);
  
  // Stats
  const stats = useMemo(() => {
    const withPolicy = leads.filter((l) => l.policyNumber).length;
    const withoutPolicy = leads.length - withPolicy;
    return { total: leads.length, withPolicy, withoutPolicy };
  }, [leads]);
  
  // Open attach modal
  const openAttachModal = (lead: LeadPolicyRow) => {
    setSelectedLead(lead);
    setPolicyNumberInput(lead.policyNumber || "");
    setAttachError(null);
    setAttachSuccess(false);
  };
  
  // Close modal
  const closeAttachModal = () => {
    setSelectedLead(null);
    setPolicyNumberInput("");
    setAttachError(null);
    setAttachSuccess(false);
  };
  
  // Save policy attachment
  const savePolicyAttachment = async () => {
    if (!selectedLead) return;
    setAttaching(true);
    setAttachError(null);
    
    try {
      const policyNum = policyNumberInput.trim();
      const { error } = await supabase
        .from("leads")
        .update({ policy_id: policyNum || null })
        .eq("id", selectedLead.leadId);
      
      if (error) throw error;
      
      // Update local state
      setLeads((prev) =>
        prev.map((l) =>
          l.leadId === selectedLead.leadId
            ? { ...l, policyNumber: policyNum }
            : l
        )
      );
      setAttachSuccess(true);
      setTimeout(() => {
        closeAttachModal();
      }, 1000);
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : "Failed to update policy");
    } finally {
      setAttaching(false);
    }
  };

  const toggleLeadSelection = useCallback((leadId: string, checked: boolean) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(leadId);
      else next.delete(leadId);
      return next;
    });
  }, []);

  const toggleSelectAllVisibleNoPolicy = useCallback((checked: boolean) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      for (const row of noPolicyPaginated) {
        if (checked) next.add(row.leadId);
        else next.delete(row.leadId);
      }
      return next;
    });
  }, [noPolicyPaginated]);

  const selectAllNoPolicyFiltered = useCallback(() => {
    setSelectedLeadIds(new Set(noPolicyFiltered.map((row) => row.leadId)));
  }, [noPolicyFiltered]);

  const clearSelection = useCallback(() => {
    setSelectedLeadIds(new Set());
  }, []);

  const bulkSetSync = useCallback(async (value: boolean) => {
    const selectedRows = leads.filter((row) => selectedLeadIds.has(row.leadId));
    if (selectedRows.length === 0) {
      setBulkNotice({ tone: "error", message: "Select at least one lead." });
      return;
    }

    setBulkSyncing(true);
    setBulkNotice(null);
    try {
      const leadIds = selectedRows.map((row) => row.leadId);
      const { error: updateError } = await supabase
        .from("leads")
        .update({ sync_required: value })
        .in("id", leadIds);

      if (updateError) throw updateError;

      setBulkNotice({ tone: "success", message: `${value ? "Enabled" : "Disabled"} sync for ${leadIds.length} lead(s).` });
      setSelectedLeadIds(new Set());
      loadLeads();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setBulkNotice({ tone: "error", message: `Failed: ${msg}` });
    } finally {
      setBulkSyncing(false);
    }
  }, [leads, selectedLeadIds, supabase, loadLeads]);

  const openBulkSyncPreview = useCallback(async () => {
    const selectedRows = noPolicyFiltered.filter((row) => selectedLeadIds.has(row.leadId));
    if (selectedRows.length === 0) {
      setBulkNotice({ tone: "error", message: "Select at least one lead with no policy ID." });
      return;
    }

    setBulkSyncing(true);
    setBulkNotice(null);
    try {
      const localCallCenterRowsRes = await supabase.from("call_centers").select("id, name");
      if (localCallCenterRowsRes.error) throw localCallCenterRowsRes.error;
      const localCallCenterRows = (localCallCenterRowsRes.data ?? []) as Array<{ id: string; name: string | null }>;
      const localCallCenterByName = new Map<string, string>();
      for (const row of localCallCenterRows) {
        const key = normalizeName(row.name);
        if (key) localCallCenterByName.set(key, row.id);
      }

      const ghlNames = Array.from(new Set(selectedRows.map((row) => String(row.fullName ?? "").trim()).filter(Boolean)));
      const names = ghlNames;
      const phones = Array.from(
        new Set(
          selectedRows
            .map((row) => normalizePhoneDigits(row.phone))
            .filter((phone) => phone.length > 0),
        ),
      );

      const [externalCandidates, uniqueValues] = await Promise.all([
        fetchDealTrackerCandidatesByNamesAndPhones({ ghlNames, names, phones }),
        fetchDealTrackerUniqueCarrierAndCallCenterValues(),
      ]);

      const trackerCarrierSet = new Set(uniqueValues.carriers.map((v) => normalizeName(v)));
      const trackerCallCenterSet = new Set(uniqueValues.callCenters.map((v) => normalizeName(v)));

      const updates: Array<{
        leadId: string;
        leadNameCrm: string;
        leadNameDt: string;
        callCenterCrm: string;
        callCenterDt: string;
        policyIdCrm: string;
        policyIdDt: string;
        carrierCrm: string;
        carrierDt: string;
      }> = [];
      let noMatch = 0;
      let noPolicyInExternal = 0;

      for (const row of selectedRows) {
        const nameKey = normalizeName(row.fullName);
        const rowFirst = normalizeName(row.firstName);
        const rowLast = normalizeName(row.lastName);
        const rowTokens = tokenizeName(row.fullName);
        const rowPhone = normalizePhoneDigits(row.phone);
        let external: DealTrackerRow | null = null;
        let bestScore = -1;
        let matchedBy = "";
        for (const candidate of externalCandidates) {
          const candidateGhlName = normalizeName(candidate.ghl_name);
          const candidateName = normalizeName(candidate.name);
          const candidateTokens = tokenizeName(candidate.ghl_name || candidate.name);
          const candidatePhone = normalizePhoneDigits(candidate.phone_number);
          let score = 0;
          if (candidateGhlName && candidateGhlName === nameKey) score += 100;
          if (candidateName && candidateName === nameKey) score += 60;
          const firstToken = candidateTokens[0] ?? "";
          const lastToken = candidateTokens[candidateTokens.length - 1] ?? "";
          if (rowFirst && rowLast && firstToken === rowFirst && lastToken === rowLast) {
            score += 85;
          }
          if (rowLast && candidateTokens.includes(rowLast)) score += 20;
          if (rowFirst && candidateTokens.includes(rowFirst)) score += 20;
          if (
            rowTokens.length >= 2 &&
            candidateTokens.length >= 2 &&
            rowTokens.some((t) => t.length > 1 && candidateTokens.includes(t))
          ) {
            score += 10;
          }
          if (rowPhone && candidatePhone && rowPhone === candidatePhone) score += 50;
          if (score > bestScore) {
            bestScore = score;
            external = candidate;
            if (candidateGhlName && candidateGhlName === nameKey) matchedBy = "ghl_name";
            else if (candidateName && candidateName === nameKey) matchedBy = "name";
            else if (rowPhone && candidatePhone && rowPhone === candidatePhone) matchedBy = "phone";
            else matchedBy = "name+phone";
          }
        }
        if (bestScore < 70) {
          external = null;
        }
        if (!external) {
          noMatch += 1;
          continue;
        }

        const policyNumber = String(external.policy_number ?? "").trim();
        if (!policyNumber) {
          noPolicyInExternal += 1;
          continue;
        }

        const externalCarrier = String(external.carrier ?? "").trim();
        const carrier =
          externalCarrier && trackerCarrierSet.has(normalizeName(externalCarrier))
            ? externalCarrier
            : null;

        const externalCallCenter = String(external.call_center ?? "").trim();
        const normalizedCallCenter = normalizeName(externalCallCenter);
        const callCenterName =
          normalizedCallCenter && trackerCallCenterSet.has(normalizedCallCenter)
            ? externalCallCenter
            : "";

        void matchedBy;
        updates.push({
          leadId: row.leadId,
          leadNameCrm: row.fullName,
          leadNameDt: String(external.ghl_name || external.name || "").trim(),
          callCenterCrm: String(row.callCenterName ?? "").trim(),
          callCenterDt: String(callCenterName ?? "").trim(),
          policyIdCrm: String(row.policyNumber ?? "").trim(),
          policyIdDt: policyNumber,
          carrierCrm: String(row.carrier ?? "").trim(),
          carrierDt: String(carrier ?? "").trim(),
        });
      }
      const previewRows: BulkPreviewRow[] = updates.map((u) => ({
        leadId: u.leadId,
        leadNameCrm: u.leadNameCrm,
        leadNameDt: u.leadNameDt,
        callCenterCrm: u.callCenterCrm,
        callCenterDt: u.callCenterDt,
        policyIdCrm: u.policyIdCrm,
        policyIdDt: u.policyIdDt,
        carrierCrm: u.carrierCrm,
        carrierDt: u.carrierDt,
      }));

      setCarrierOptions(uniqueValues.carriers);
      setCallCenterOptions(uniqueValues.callCenters);
      setBulkPreviewRows(previewRows);
      setBulkPreviewPage(1);
      setBulkPreviewView("all");
      setBulkPreviewOpen(true);
      setBulkNotice({
        tone: previewRows.length > 0 ? "success" : "error",
        message:
          (previewRows.length > 0
            ? `Prepared preview for ${previewRows.length}/${selectedRows.length} leads`
            : "No preview rows generated") +
          `${noMatch ? `, ${noMatch} no Deal Tracker name match` : ""}` +
          `${noPolicyInExternal ? `, ${noPolicyInExternal} missing external policy number` : ""}.`,
      });
    } catch (e) {
      setBulkNotice({
        tone: "error",
        message: e instanceof Error ? e.message : "Bulk sync failed.",
      });
    } finally {
      setBulkSyncing(false);
    }
  }, [noPolicyFiltered, normalizeName, normalizePhoneDigits, selectedLeadIds, supabase, tokenizeName]);

  const removePreviewLead = useCallback((leadId: string) => {
    setBulkPreviewRows((prev) => prev.filter((row) => row.leadId !== leadId));
  }, []);

  const saveBulkPreviewToDb = useCallback(async () => {
    if (bulkPreviewRows.length === 0) {
      setBulkNotice({ tone: "error", message: "No preview rows to save." });
      return;
    }
    setBulkPreviewSaving(true);
    try {
      const localCallCenterRowsRes = await supabase.from("call_centers").select("id, name");
      if (localCallCenterRowsRes.error) throw localCallCenterRowsRes.error;
      const localCallCenterRows = (localCallCenterRowsRes.data ?? []) as Array<{ id: string; name: string | null }>;
      const localCallCenterByName = new Map<string, string>();
      for (const row of localCallCenterRows) {
        const key = normalizeName(row.name);
        if (key) localCallCenterByName.set(key, row.id);
      }

      let synced = 0;
      let failed = 0;
      const successfulLeadIds = new Set<string>();
      for (const row of bulkPreviewRows) {
        const policy = String(row.policyIdDt ?? "").trim();
        if (!policy) continue;
        const payload: { policy_id: string; carrier?: string; call_center_id?: string } = {
          policy_id: policy,
        };
        const carrier = String(row.carrierDt ?? "").trim();
        if (carrier) payload.carrier = carrier;
        const ccName = String(row.callCenterDt ?? "").trim();
        const ccId = ccName ? localCallCenterByName.get(normalizeName(ccName)) : null;
        if (ccId) payload.call_center_id = ccId;

        const { error } = await supabase.from("leads").update(payload).eq("id", row.leadId);
        if (error) {
          failed += 1;
          continue;
        }
        synced += 1;
        successfulLeadIds.add(row.leadId);
      }

      const syncedByLeadId = new Map(
        bulkPreviewRows.filter((u) => successfulLeadIds.has(u.leadId)).map((u) => [u.leadId, u]),
      );
      setLeads((prev) =>
        prev.map((lead) => {
          const s = syncedByLeadId.get(lead.leadId);
          if (!s) return lead;
          return {
            ...lead,
            policyNumber: s.policyIdDt,
            carrier: s.carrierDt || lead.carrier,
            callCenterName: s.callCenterDt || lead.callCenterName,
          };
        }),
      );
      setSelectedLeadIds(new Set());
      setBulkPreviewOpen(false);
      setBulkPreviewRows([]);
      setBulkNotice({
        tone: failed > 0 ? "error" : "success",
        message: `Preview save completed. Synced ${synced}/${bulkPreviewRows.length} leads` +
          `${failed ? `, ${failed} update errors` : ""}.`,
      });
    } catch (e) {
      setBulkNotice({
        tone: "error",
        message: e instanceof Error ? e.message : "Failed to save preview data.",
      });
    } finally {
      setBulkPreviewSaving(false);
    }
  }, [bulkPreviewRows, normalizeName, supabase]);
  
  // Get available stages based on selected pipeline
  const availableStages = useMemo(() => {
    if (pipelineFilter === "all") return stages;
    return stages.filter((s) => String(s.pipeline_id) === pipelineFilter);
  }, [stages, pipelineFilter]);
  
  return (
    <div style={{ animation: "fadeIn 0.3s ease-out" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ maxWidth: 640 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 800,
              color: "#233217",
              letterSpacing: "-0.01em",
            }}
          >
            Policy Attachment & Review
          </h2>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 13,
              color: T.textMuted,
              fontWeight: 500,
              lineHeight: 1.55,
            }}
          >
            View and manage policy ID attachments for leads. Filter by pipeline, stage, or policy status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadLeads()}
          disabled={loading || bulkSyncing}
          style={{
            height: 40,
            padding: "0 18px",
            borderRadius: 12,
            border: "none",
            background: "#233217",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: T.font,
            cursor: loading ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            opacity: loading ? 0.6 : 1,
            boxShadow: "0 4px 14px rgba(35, 50, 23, 0.25)",
            transition: "all 0.15s ease-in-out",
          }}
        >
          <RefreshCw size={16} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {policyFilter === "no" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 12,
            padding: "12px 16px",
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            background: "#f8faf8",
          }}
        >
          <div style={{ fontSize: 13, color: T.textDark, fontWeight: 600 }}>
            Selected {noPolicySelectedCount} of {noPolicyFiltered.length} no-policy leads
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={selectAllNoPolicyFiltered}
              disabled={bulkSyncing || noPolicyFiltered.length === 0}
              style={{
                height: 34,
                padding: "0 12px",
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: T.cardBg,
                color: T.textDark,
                fontSize: 12,
                fontWeight: 700,
                cursor: bulkSyncing || noPolicyFiltered.length === 0 ? "not-allowed" : "pointer",
                opacity: bulkSyncing || noPolicyFiltered.length === 0 ? 0.6 : 1,
              }}
            >
              Select all
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={bulkSyncing || noPolicySelectedCount === 0}
              style={{
                height: 34,
                padding: "0 12px",
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: T.cardBg,
                color: T.textDark,
                fontSize: 12,
                fontWeight: 700,
                cursor: bulkSyncing || noPolicySelectedCount === 0 ? "not-allowed" : "pointer",
                opacity: bulkSyncing || noPolicySelectedCount === 0 ? 0.6 : 1,
              }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => void openBulkSyncPreview()}
              disabled={bulkSyncing || noPolicySelectedCount === 0}
              style={{
                height: 34,
                padding: "0 14px",
                borderRadius: 8,
                border: "none",
                background: "#233217",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: bulkSyncing || noPolicySelectedCount === 0 ? "not-allowed" : "pointer",
                opacity: bulkSyncing || noPolicySelectedCount === 0 ? 0.6 : 1,
              }}
            >
              {bulkSyncing ? "Preparing..." : "Preview Bulk Sync"}
            </button>
          </div>
        </div>
      )}

      {bulkNotice && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            borderRadius: 10,
            border: `1px solid ${bulkNotice.tone === "success" ? "#86efac" : "#fecaca"}`,
            background: bulkNotice.tone === "success" ? "#f0fdf4" : "#fef2f2",
            color: bulkNotice.tone === "success" ? "#166534" : "#991b1b",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {bulkNotice.message}
        </div>
      )}

      {/* Bulk Enable Sync Action - shows when any leads are selected */}
      {selectedLeadIds.size > 0 && !bulkPreviewOpen && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
            padding: "12px 16px",
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            background: "#f8faf8",
          }}
        >
          <div style={{ fontSize: 13, color: T.textDark, fontWeight: 600 }}>
            Selected {selectedLeadIds.size} lead(s)
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setSelectedLeadIds(new Set())}
              disabled={bulkSyncing || selectedLeadIds.size === 0}
              style={{
                height: 34,
                padding: "0 12px",
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: T.cardBg,
                color: T.textDark,
                fontSize: 12,
                fontWeight: 700,
                cursor: bulkSyncing || selectedLeadIds.size === 0 ? "not-allowed" : "pointer",
                opacity: bulkSyncing || selectedLeadIds.size === 0 ? 0.6 : 1,
              }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => void bulkSetSync(false)}
              disabled={bulkSyncing || selectedLeadIds.size === 0}
              style={{
                height: 34,
                padding: "0 14px",
                borderRadius: 8,
                border: "none",
                background: "#647864",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: bulkSyncing || selectedLeadIds.size === 0 ? "not-allowed" : "pointer",
                opacity: bulkSyncing || selectedLeadIds.size === 0 ? 0.6 : 1,
              }}
            >
              {bulkSyncing ? "Updating..." : "Disable Sync"}
            </button>
            <button
              type="button"
              onClick={() => void bulkSetSync(true)}
              disabled={bulkSyncing || selectedLeadIds.size === 0}
              style={{
                height: 34,
                padding: "0 14px",
                borderRadius: 8,
                border: "none",
                background: "#8b5cf6",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: bulkSyncing || selectedLeadIds.size === 0 ? "not-allowed" : "pointer",
                opacity: bulkSyncing || selectedLeadIds.size === 0 ? 0.6 : 1,
              }}
            >
              {bulkSyncing ? "Updating..." : "Enable Sync"}
            </button>
          </div>
        </div>
      )}
      
      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 20,
          marginBottom: 24,
        }}
      >
        <StatCard
          label="Total Leads"
          value={stats.total.toLocaleString()}
          icon={<Database size={18} />}
          tone="#233217"
        />
        <StatCard
          label="With Policy ID"
          value={stats.withPolicy.toLocaleString()}
          icon={<CheckCircle2 size={18} />}
          tone="#16a34a"
        />
        <StatCard
          label="Without Policy ID"
          value={stats.withoutPolicy.toLocaleString()}
          icon={<AlertTriangle size={18} />}
          tone="#d97706"
        />
      </div>
      
      {/* Filters */}
      <div
        style={{
          width: "100%",
          background: T.cardBg,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          padding: "16px 20px",
          boxShadow: T.shadowSm,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Policy Filter Buttons - Primary Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {[
              { key: "all", label: "All Leads", color: "#233217" },
              { key: "has", label: "Has Policy ID", color: "#16a34a" },
              { key: "no", label: "No Policy ID", color: "#d97706" },
            ].map(({ key, label, color }) => {
              const isActive = policyFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setPolicyFilter(key as "all" | "has" | "no")}
                  style={{
                    height: 38,
                    padding: "0 16px",
                    borderRadius: 10,
                    border: isActive ? `2px solid ${color}` : `1px solid ${T.border}`,
                    background: isActive ? `${color}15` : T.pageBg,
                    color: isActive ? color : T.textMid,
                    fontSize: 13,
                    fontWeight: isActive ? 800 : 600,
                    cursor: "pointer",
                    fontFamily: T.font,
                    transition: "all 0.15s ease-in-out",
                    boxShadow: isActive ? `0 2px 8px ${color}30` : "none",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          
          {/* Divider */}
          <div style={{ width: 1, height: 28, backgroundColor: T.border, margin: "0 4px" }} />
          
          {/* Sync Required Filter - Secondary */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {[
              { key: "all", label: "All Sync", color: "#233217" },
              { key: "true", label: "Sync Required", color: "#8b5cf6" },
              { key: "false", label: "No Sync", color: "#647864" },
            ].map(({ key, label, color }) => {
              const isActive = syncRequiredFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setSyncRequiredFilter(key as "all" | "true" | "false")}
                  style={{
                    height: 38,
                    padding: "0 16px",
                    borderRadius: 10,
                    border: isActive ? `2px solid ${color}` : `1px solid ${T.border}`,
                    background: isActive ? `${color}15` : T.pageBg,
                    color: isActive ? color : T.textMid,
                    fontSize: 13,
                    fontWeight: isActive ? 800 : 600,
                    cursor: "pointer",
                    fontFamily: T.font,
                    transition: "all 0.15s ease-in-out",
                    boxShadow: isActive ? `0 2px 8px ${color}30` : "none",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 28, backgroundColor: T.border, margin: "0 4px" }} />
          
          {/* Pipeline Filter - Secondary */}
          <select
            value={pipelineFilter}
            onChange={(e) => {
              setPipelineFilter(e.target.value);
              setStageFilter("all");
            }}
            style={{
              height: 38,
              padding: "0 14px",
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 500,
              color: T.textDark,
              background: T.cardBg,
              outline: "none",
              cursor: "pointer",
              fontFamily: T.font,
            }}
          >
            <option value="all">All Pipelines</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          
          {/* Stage Filter - Secondary */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            style={{
              height: 38,
              padding: "0 14px",
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 500,
              color: T.textDark,
              background: T.cardBg,
              outline: "none",
              cursor: "pointer",
              fontFamily: T.font,
            }}
          >
            <option value="all">All Stages</option>
            {availableStages.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
          
          {/* Divider */}
          <div style={{ width: 1, height: 28, backgroundColor: T.border, margin: "0 4px" }} />
          
          {/* Search */}
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={16} style={{ position: "absolute", left: 12, pointerEvents: "none", zIndex: 1, color: T.textMuted }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads..."
              style={{
                height: 38,
                minWidth: 220,
                paddingLeft: 38,
                paddingRight: 14,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                fontSize: 14,
                color: T.textDark,
                background: T.pageBg,
                outline: "none",
                fontFamily: T.font,
                transition: "all 0.15s ease-in-out",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#233217";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(35, 50, 23, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = T.border;
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>
        </div>
      </div>
      
      {/* Table */}
      <div
        style={{
          borderRadius: 16,
          border: `1px solid ${T.border}`,
          overflow: "hidden",
          backgroundColor: T.cardBg,
        }}
      >
        {loading ? (
          <div style={{ padding: "80px 40px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
            <LoadingSpinner size={48} label="Loading leads..." />
          </div>
        ) : paginated.length === 0 ? (
          <div style={{ padding: "60px 40px", textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.textMuted, marginBottom: 8 }}>
              No leads found
            </div>
            <div style={{ fontSize: 14, color: T.textMid }}>
              Try adjusting your filters or search criteria.
            </div>
          </div>
        ) : (
          <>
            <div style={{ borderBottom: `1px solid ${T.border}`, overflow: "hidden", backgroundColor: T.cardBg }}>
              <ShadcnTable>
                <TableHeader style={{ backgroundColor: "#233217" }}>
                  <TableRow style={{ borderBottom: "none" }} className="hover:bg-transparent">
                    {[
                      ...(policyFilter === "no"
                        ? [{ label: "", align: "center" as const }]
                        : []),
                      { label: "S.No", align: "left" as const },
                      { label: "Lead", align: "left" as const },
                      { label: "Phone", align: "left" as const },
                      { label: "Policy #", align: "left" as const },
                      { label: "Stage", align: "left" as const },
                      { label: "Carrier", align: "left" as const },
                      { label: "Actions", align: "right" as const },
                    ].map(({ label, align }) => (
                      <TableHead
                        key={label}
                        style={{
                          color: "#ffffff",
                          fontWeight: 700,
                          fontSize: 12,
                          letterSpacing: "0.3px",
                          padding: "16px 20px",
                          whiteSpace: "nowrap",
                          textAlign: align,
                        }}
                      >
                        {label || (policyFilter === "no" ? (
                          <input
                            type="checkbox"
                            checked={pageNoPolicyAllSelected}
                            onChange={(e) => toggleSelectAllVisibleNoPolicy(e.target.checked)}
                            disabled={noPolicyPaginated.length === 0 || bulkSyncing}
                          />
                        ) : null)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((row, i) => (
                    <TableRow
                      key={row.leadId}
                      style={{ borderBottom: `1px solid ${T.border}` }}
                      className="hover:bg-muted/30 transition-all duration-150"
                    >
                      {policyFilter === "no" && (
                        <TableCell style={{ padding: "14px 12px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.has(row.leadId)}
                            onChange={(e) => toggleLeadSelection(row.leadId, e.target.checked)}
                            disabled={!!row.policyNumber || bulkSyncing}
                          />
                        </TableCell>
                      )}
                      <TableCell style={{ padding: "14px 20px" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.textMuted }}>
                          {(page - 1) * ITEMS_PER_PAGE + i + 1}
                        </span>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: T.textDark }}>
                            {row.fullName}
                          </span>
                          <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500, fontFamily: "monospace" }}>
                            {row.leadDisplayId}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        <span style={{ fontSize: 12, color: T.textMid, fontWeight: 500 }}>
                          {formatPhone(row.phone) || "—"}
                        </span>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        {row.policyNumber ? (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#16a34a",
                              fontFamily: "monospace",
                              padding: "4px 8px",
                              borderRadius: 6,
                              backgroundColor: "#dcfce7",
                            }}
                          >
                            {row.policyNumber}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: T.textMuted, fontStyle: "italic" }}>
                            Not attached
                          </span>
                        )}
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        {row.stage ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "4px 10px",
                              borderRadius: 6,
                              backgroundColor: "#DCEBDC",
                              color: "#233217",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {row.stage}
                          </span>
                        ) : (
                          <span style={{ color: T.textMuted, fontSize: 13 }}>—</span>
                        )}
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        {row.carrier ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "4px 10px",
                              borderRadius: 6,
                              backgroundColor: "#EEF5EE",
                              color: "#233217",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {row.carrier}
                          </span>
                        ) : (
                          <span style={{ color: T.textMuted, fontSize: 13 }}>—</span>
                        )}
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px", textAlign: "right" }}>
                        <button
                          onClick={() => openAttachModal(row)}
                          style={{
                            height: 32,
                            padding: "0 14px",
                            borderRadius: 8,
                            border: row.policyNumber ? `1px solid ${T.border}` : "none",
                            background: row.policyNumber ? T.pageBg : "#233217",
                            color: row.policyNumber ? T.textDark : "#fff",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: T.font,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            transition: "all 0.15s ease-in-out",
                          }}
                        >
                          <Link2 size={14} />
                          {row.policyNumber ? "Edit Policy" : "Attach Policy"}
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </ShadcnTable>
            </div>
            
            {/* Pagination */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 20px",
                borderTop: `1px solid ${T.border}`,
                backgroundColor: "#fafafa",
              }}
            >
              <span style={{ fontSize: 13, color: T.textMuted }}>
                Showing {(page - 1) * ITEMS_PER_PAGE + 1} - {Math.min(page * ITEMS_PER_PAGE, filtered.length)} of{" "}
                {filtered.length} leads
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    background: T.cardBg,
                    color: page === 1 ? T.textMuted : T.textDark,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: page === 1 ? "not-allowed" : "pointer",
                    opacity: page === 1 ? 0.5 : 1,
                  }}
                >
                  Previous
                </button>
                <span style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: T.textDark }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    background: T.cardBg,
                    color: page === totalPages ? T.textMuted : T.textDark,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: page === totalPages ? "not-allowed" : "pointer",
                    opacity: page === totalPages ? 0.5 : 1,
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Policy Attachment Modal */}
      {bulkPreviewOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 9998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => {
            if (!bulkPreviewSaving) setBulkPreviewOpen(false);
          }}
        >
          <Card
            style={{
              width: "100%",
              maxWidth: 1500,
              maxHeight: "90vh",
              overflow: "auto",
              backgroundColor: T.cardBg,
              borderRadius: 16,
              border: `1px solid ${T.border}`,
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: "#233217" }}>Bulk Sync Preview (Editable)</h3>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: T.textMuted }}>
                  Review/edit values, remove unwanted leads, then save.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBulkPreviewOpen(false)}
                disabled={bulkPreviewSaving}
                style={{ border: "none", background: "transparent", cursor: bulkPreviewSaving ? "not-allowed" : "pointer" }}
              >
                <X size={18} color={T.textMid} />
              </button>
            </div>

            <div style={{ padding: 16 }}>
              {bulkPreviewRows.length > 0 && (
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  {[
                    { key: "all" as const, label: `All (${bulkPreviewRows.length})` },
                    {
                      key: "different" as const,
                      label: `Different (${bulkPreviewRows.filter((row) => {
                        const crmName = normalizeName(row.leadNameCrm);
                        const dtName = normalizeName(row.leadNameDt);
                        const crmCc = normalizeName(row.callCenterCrm);
                        const dtCc = normalizeName(row.callCenterDt);
                        return crmName !== dtName || crmCc !== dtCc;
                      }).length})`,
                    },
                  ].map((tab) => {
                    const active = bulkPreviewView === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => {
                          setBulkPreviewView(tab.key);
                          setBulkPreviewPage(1);
                        }}
                        style={{
                          height: 32,
                          padding: "0 12px",
                          borderRadius: 8,
                          border: active ? "2px solid #233217" : `1px solid ${T.border}`,
                          background: active ? "#eef5ee" : T.cardBg,
                          color: active ? "#233217" : T.textDark,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              )}
              {bulkPreviewRows.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: T.textMuted, fontWeight: 600 }}>
                  No rows in preview.
                </div>
              ) : (
                <ShadcnTable>
                  <TableHeader>
                    <TableRow>
                      <TableHead style={{ textAlign: "left" }}>Action</TableHead>
                      <TableHead>Lead Name CRM</TableHead>
                      <TableHead>Lead Name DT</TableHead>
                      <TableHead>Call Center CRM</TableHead>
                      <TableHead>Call Center DT</TableHead>
                      <TableHead>Policy ID CRM</TableHead>
                      <TableHead>Policy ID DT</TableHead>
                      <TableHead>Carrier CRM</TableHead>
                      <TableHead>Carrier DT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkPreviewPaginatedRows.map((row) => (
                      <TableRow key={row.leadId}>
                        <TableCell style={{ textAlign: "left" }}>
                          <button
                            type="button"
                            onClick={() => removePreviewLead(row.leadId)}
                            style={{
                              height: 30,
                              borderRadius: 8,
                              border: `1px solid #fecaca`,
                              background: "#fff1f2",
                              color: "#b91c1c",
                              fontSize: 12,
                              fontWeight: 700,
                              padding: "0 10px",
                              cursor: "pointer",
                            }}
                          >
                            Remove
                          </button>
                        </TableCell>
                        <TableCell>{row.leadNameCrm || "—"}</TableCell>
                        <TableCell>{row.leadNameDt || "—"}</TableCell>
                        <TableCell>{row.callCenterCrm || "—"}</TableCell>
                        <TableCell>
                          <input
                            list="bulk-callcenter-options"
                            value={row.callCenterDt}
                            onChange={(e) =>
                              setBulkPreviewRows((prev) =>
                                prev.map((r) => (r.leadId === row.leadId ? { ...r, callCenterDt: e.target.value } : r)),
                              )
                            }
                            style={{ width: 190, height: 32, border: `1px solid ${T.border}`, borderRadius: 8, padding: "0 10px" }}
                          />
                        </TableCell>
                        <TableCell>{row.policyIdCrm || "—"}</TableCell>
                        <TableCell>
                          <input
                            value={row.policyIdDt}
                            onChange={(e) =>
                              setBulkPreviewRows((prev) =>
                                prev.map((r) => (r.leadId === row.leadId ? { ...r, policyIdDt: e.target.value } : r)),
                              )
                            }
                            style={{ width: 180, height: 32, border: `1px solid ${T.border}`, borderRadius: 8, padding: "0 10px", fontFamily: "monospace" }}
                          />
                        </TableCell>
                        <TableCell>{row.carrierCrm || "—"}</TableCell>
                        <TableCell>
                          <input
                            list="bulk-carrier-options"
                            value={row.carrierDt}
                            onChange={(e) =>
                              setBulkPreviewRows((prev) =>
                                prev.map((r) => (r.leadId === row.leadId ? { ...r, carrierDt: e.target.value } : r)),
                              )
                            }
                            style={{ width: 180, height: 32, border: `1px solid ${T.border}`, borderRadius: 8, padding: "0 10px" }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </ShadcnTable>
              )}
              {bulkPreviewRows.length > 0 && (
                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>
                    Showing {(bulkPreviewPage - 1) * BULK_PREVIEW_ITEMS_PER_PAGE + 1} -{" "}
                    {Math.min(bulkPreviewPage * BULK_PREVIEW_ITEMS_PER_PAGE, bulkPreviewViewRows.length)} of{" "}
                    {bulkPreviewViewRows.length}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setBulkPreviewPage((p) => Math.max(1, p - 1))}
                      disabled={bulkPreviewPage === 1}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: `1px solid ${T.border}`,
                        background: T.cardBg,
                        color: bulkPreviewPage === 1 ? T.textMuted : T.textDark,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: bulkPreviewPage === 1 ? "not-allowed" : "pointer",
                        opacity: bulkPreviewPage === 1 ? 0.6 : 1,
                      }}
                    >
                      Previous
                    </button>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>
                      Page {bulkPreviewPage} of {bulkPreviewTotalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setBulkPreviewPage((p) => Math.min(bulkPreviewTotalPages, p + 1))}
                      disabled={bulkPreviewPage >= bulkPreviewTotalPages}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: `1px solid ${T.border}`,
                        background: T.cardBg,
                        color: bulkPreviewPage >= bulkPreviewTotalPages ? T.textMuted : T.textDark,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: bulkPreviewPage >= bulkPreviewTotalPages ? "not-allowed" : "pointer",
                        opacity: bulkPreviewPage >= bulkPreviewTotalPages ? 0.6 : 1,
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
              <datalist id="bulk-carrier-options">
                {carrierOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <datalist id="bulk-callcenter-options">
                {callCenterOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setBulkPreviewOpen(false)}
                disabled={bulkPreviewSaving}
                style={{ height: 36, padding: "0 14px", borderRadius: 8, border: `1px solid ${T.border}`, background: "#fff", fontWeight: 700 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveBulkPreviewToDb()}
                disabled={bulkPreviewSaving || bulkPreviewRows.length === 0}
                style={{ height: 36, padding: "0 14px", borderRadius: 8, border: "none", background: "#233217", color: "#fff", fontWeight: 700, opacity: bulkPreviewSaving || bulkPreviewRows.length === 0 ? 0.6 : 1 }}
              >
                {bulkPreviewSaving ? "Saving..." : "Save Preview to DB"}
              </button>
            </div>
          </Card>
        </div>
      )}

      {selectedLead && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={closeAttachModal}
        >
          <Card
            style={{
              width: "100%",
              maxWidth: 480,
              backgroundColor: T.cardBg,
              borderRadius: 16,
              border: `1px solid ${T.border}`,
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: `1px solid ${T.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#f8faf8",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#233217" }}>
                  {selectedLead.policyNumber ? "Edit Policy ID" : "Attach Policy ID"}
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>
                  {selectedLead.fullName}
                </p>
              </div>
              <button
                onClick={closeAttachModal}
                disabled={attaching}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: "transparent",
                  cursor: attaching ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={18} color="#647864" />
              </button>
            </div>
            
            {/* Content */}
            <div style={{ padding: "24px" }}>
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#233217",
                    textTransform: "uppercase",
                    letterSpacing: "0.3px",
                    marginBottom: 8,
                  }}
                >
                  Policy Number
                </label>
                <input
                  type="text"
                  value={policyNumberInput}
                  onChange={(e) => setPolicyNumberInput(e.target.value)}
                  placeholder="Enter policy number..."
                  style={{
                    width: "100%",
                    height: 44,
                    padding: "0 14px",
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    fontSize: 14,
                    color: T.textDark,
                    background: T.cardBg,
                    outline: "none",
                    fontFamily: "monospace",
                    transition: "all 0.15s ease-in-out",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#233217";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(35, 50, 23, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                <p style={{ margin: "8px 0 0", fontSize: 12, color: T.textMuted }}>
                  Leave empty to remove the policy ID from this lead.
                </p>
              </div>
              
              {attachError && (
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: 8,
                    backgroundColor: "#fef2f2",
                    color: "#dc2626",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 16,
                  }}
                >
                  {attachError}
                </div>
              )}
              
              {attachSuccess && (
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: 8,
                    backgroundColor: "#dcfce7",
                    color: "#166534",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 16,
                  }}
                >
                  Policy ID updated successfully!
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: `1px solid ${T.border}`,
                backgroundColor: "#f8faf8",
                display: "flex",
                justifyContent: "flex-end",
                gap: 12,
              }}
            >
              <button
                onClick={closeAttachModal}
                disabled={attaching}
                style={{
                  height: 40,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: "white",
                  color: T.textDark,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: attaching ? "not-allowed" : "pointer",
                  fontFamily: T.font,
                }}
              >
                Cancel
              </button>
              <button
                onClick={savePolicyAttachment}
                disabled={attaching}
                style={{
                  height: 40,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: "none",
                  background: "#233217",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: attaching ? "not-allowed" : "pointer",
                  fontFamily: T.font,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {attaching ? (
                  <>
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "white",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Save
                  </>
                )}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
