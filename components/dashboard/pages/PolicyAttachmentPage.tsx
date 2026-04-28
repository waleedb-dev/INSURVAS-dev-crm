"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  fetchDealTrackerCandidatesByNamesAndPhones,
  fetchDealTrackerUniqueCarrierAndCallCenterValues,
  type DealTrackerRow,
} from "@/lib/supabase/dealTrackerClient";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";
import {
  CheckCircle2,
  Link2,
  Lock,
  RefreshCw,
  Search,
  Trash2,
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
  policyNumber: string;
  carrier: string | null;
  productType: string | null;
  monthlyPremium: string | null;
  leadValue: number | null;
  leadSource: string | null;
  submissionDate: string | null;
  updatedAt: string | null;
  createdAt: string | null;
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
  selected: boolean;
};

const ITEMS_PER_PAGE = 50;
const BULK_PREVIEW_ITEMS_PER_PAGE = 20;

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

export default function PolicyAttachmentPage() {
  const { currentRole } = useDashboardContext();

  if (currentRole !== "system_admin") {
    return <AccessRestricted />;
  }

  return <PolicyAttachmentTab />;
}

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

  const [pipelineFilter, setPipelineFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [policyFilter, setPolicyFilter] = useState<"all" | "has" | "no">("all");
  const [syncRequiredFilter, setSyncRequiredFilter] = useState<"all" | "true" | "false">("all");
  const [callCenterFilter, setCallCenterFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [pipelines, setPipelines] = useState<Array<{ id: string; name: string }>>([]);
  const [stages, setStages] = useState<Array<{ id: number; name: string; pipeline_id: number }>>([]);
  const [callCenters, setCallCenters] = useState<Array<{ id: string; name: string }>>([]);

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

  useEffect(() => {
    const fetchOptions = async () => {
      const [{ data: pipelineData }, { data: stageData }, { data: callCenterData }] = await Promise.all([
        supabase.from("pipelines").select("id, name").order("name"),
        supabase.from("pipeline_stages").select("id, name, pipeline_id").order("position"),
        supabase.from("call_centers").select("id, name").order("name"),
      ]);
      setPipelines(pipelineData || []);
      setStages(stageData || []);
      setCallCenters(callCenterData || []);
    };
    fetchOptions();
  }, [supabase]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const PAGE_SIZE = 1000;
      const collected: Record<string, unknown>[] = [];
      let cursorId: string | null = null;
      const MAX_ROWS = 50000;

      while (collected.length < MAX_ROWS) {
        let query = supabase
          .from("leads")
          .select(
            "id, lead_unique_id, first_name, last_name, phone, stage, pipeline_id, call_center_id, policy_id, carrier, product_type, monthly_premium, lead_value, lead_source, submission_date, updated_at, created_at"
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

        if (callCenterFilter !== "all") {
          query = query.eq("call_center_id", callCenterFilter);
        }

        if (policyFilter === "has") {
          query = query.not("policy_id", "is", null).neq("policy_id", "");
        } else if (policyFilter === "no") {
          query = query.or("policy_id.is.null,policy_id.eq.");
        }

        if (syncRequiredFilter !== "all") {
          query = query.eq("sync_required", syncRequiredFilter === "true");
        }

        if (dateFrom) {
          query = query.gte("created_at", dateFrom);
        }

        if (dateTo) {
          query = query.lte("created_at", dateTo + "T23:59:59");
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
            createdAt: lead.created_at != null ? String(lead.created_at) : null,
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
  }, [supabase, pipelineFilter, stageFilter, policyFilter, syncRequiredFilter, callCenterFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

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
  }, [search, pipelineFilter, stageFilter, policyFilter, callCenterFilter, dateFrom, dateTo]);

  useEffect(() => {
    setSelectedLeadIds(new Set());
    setBulkNotice(null);
  }, [pipelineFilter, stageFilter, search, policyFilter, callCenterFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (!bulkPreviewOpen) {
      setBulkPreviewPage(1);
      setBulkPreviewView("all");
      return;
    }
    setBulkPreviewPage((prev) => Math.min(prev, bulkPreviewTotalPages));
  }, [bulkPreviewOpen, bulkPreviewRows.length, bulkPreviewTotalPages]);

  const stats = useMemo(() => {
    const withPolicy = leads.filter((l) => l.policyNumber).length;
    const withoutPolicy = leads.length - withPolicy;
    return { total: leads.length, withPolicy, withoutPolicy };
  }, [leads]);

  const openAttachModal = (lead: LeadPolicyRow) => {
    setSelectedLead(lead);
    setPolicyNumberInput(lead.policyNumber || "");
    setAttachError(null);
    setAttachSuccess(false);
  };

  const closeAttachModal = () => {
    setSelectedLead(null);
    setPolicyNumberInput("");
    setAttachError(null);
    setAttachSuccess(false);
  };

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
        selected: true,
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
      const localCcRows = (localCallCenterRowsRes.data ?? []) as Array<{ id: string; name: string | null }>;
      const localCcByNorm = new Map<string, string>();
      for (const r of localCcRows) {
        const k = normalizeName(r.name);
        if (k) localCcByNorm.set(k, r.id);
      }
      const trackerCarrierSet = new Set(carrierOptions.map((v) => normalizeName(v)));
      const trackerCcSet = new Set(callCenterOptions.map((v) => normalizeName(v)));

      let saved = 0;
      let skipped = 0;
      for (const row of bulkPreviewRows) {
        if (!row.selected) { skipped += 1; continue; }
        const pNum = row.policyIdDt.trim();
        if (!pNum) { skipped += 1; continue; }

        const extCarrier = row.carrierDt.trim();
        const carrier = extCarrier && trackerCarrierSet.has(normalizeName(extCarrier)) ? extCarrier : null;

        const extCc = row.callCenterDt.trim();
        const callCenterId = extCc && localCcByNorm.has(normalizeName(extCc))
          ? localCcByNorm.get(normalizeName(extCc))!
          : null;

        const { error: updErr } = await supabase
          .from("leads")
          .update({
            policy_id: pNum,
            ...(carrier != null ? { carrier } : {}),
            ...(callCenterId != null ? { call_center_id: callCenterId } : {}),
            sync_required: true,
          })
          .eq("id", row.leadId);

        if (updErr) {
          console.error(`Failed to update lead ${row.leadId}:`, updErr.message);
        } else {
          saved += 1;
        }
      }

      setBulkPreviewOpen(false);
      setBulkNotice({ tone: "success", message: `Saved ${saved} lead(s)${skipped > 0 ? `, skipped ${skipped}` : ""}.` });
      setSelectedLeadIds(new Set());
      void loadLeads();
    } catch (err) {
      setBulkNotice({ tone: "error", message: err instanceof Error ? err.message : "Bulk save failed." });
    } finally {
      setBulkPreviewSaving(false);
    }
  }, [bulkPreviewRows, carrierOptions, callCenterOptions, normalizeName, supabase, loadLeads]);

  const formatPhone = (phone: string | null | undefined) => {
    const raw = String(phone ?? "").replace(/\D/g, "");
    if (raw.length === 10) {
      return `+1 (${raw.slice(0, 3)}) ${raw.slice(3, 6)}-${raw.slice(6)}`;
    }
    if (raw.length === 11 && raw.startsWith("1")) {
      return `+1 (${raw.slice(1, 4)}) ${raw.slice(4, 7)}-${raw.slice(7)}`;
    }
    return phone || "";
  };

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
            Search for leads below and attach a policy number, or bulk-sync from Deal Tracker for leads without one.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => { void loadLeads(); }}
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 20,
          marginBottom: 24,
        }}
      >
        <Card
          style={{
            borderRadius: 16,
            border: `1px solid ${T.border}`,
            borderBottom: `4px solid #233217`,
            background: `linear-gradient(135deg, rgba(35, 50, 23, 0.08) 0%, ${T.cardBg} 80%)`,
            boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
            padding: "20px 24px",
            minHeight: 100,
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#233217", letterSpacing: "0.45px", textTransform: "uppercase", lineHeight: 1.25 }}>
              Total Leads
            </span>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#233217", lineHeight: 1.05 }}>
              {loading ? "—" : stats.total.toLocaleString()}
            </div>
          </div>
          <div style={{ color: "#233217", backgroundColor: "rgba(35, 50, 23, 0.1)", width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Search size={18} />
          </div>
        </Card>

        <Card
          style={{
            borderRadius: 16,
            border: `1px solid ${T.border}`,
            borderBottom: `4px solid #16a34a`,
            background: `linear-gradient(135deg, rgba(22, 163, 74, 0.08) 0%, ${T.cardBg} 80%)`,
            boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
            padding: "20px 24px",
            minHeight: 100,
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", letterSpacing: "0.45px", textTransform: "uppercase", lineHeight: 1.25 }}>
              With Policy
            </span>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#16a34a", lineHeight: 1.05 }}>
              {loading ? "—" : stats.withPolicy.toLocaleString()}
            </div>
          </div>
          <div style={{ color: "#16a34a", backgroundColor: "rgba(22, 163, 74, 0.1)", width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Link2 size={18} />
          </div>
        </Card>

        <Card
          style={{
            borderRadius: 16,
            border: `1px solid ${T.border}`,
            borderBottom: `4px solid #d97706`,
            background: `linear-gradient(135deg, rgba(217, 119, 6, 0.08) 0%, ${T.cardBg} 80%)`,
            boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
            padding: "20px 24px",
            minHeight: 100,
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#d97706", letterSpacing: "0.45px", textTransform: "uppercase", lineHeight: 1.25 }}>
              Without Policy
            </span>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#d97706", lineHeight: 1.05 }}>
              {loading ? "—" : stats.withoutPolicy.toLocaleString()}
            </div>
          </div>
          <div style={{ color: "#d97706", backgroundColor: "rgba(217, 119, 6, 0.1)", width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={18} />
          </div>
        </Card>
      </div>

      {bulkNotice && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 12,
            background: bulkNotice.tone === "success" ? "#dcfce7" : "#fef2f2",
            color: bulkNotice.tone === "success" ? "#166534" : "#b91c1c",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {bulkNotice.message}
        </div>
      )}

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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {(
              [
                { key: "all", label: "All Leads", tone: "#233217" },
                { key: "has", label: "With Policy", tone: "#16a34a" },
                { key: "no", label: "Without Policy", tone: "#d97706" },
              ] as const
            ).map((opt) => {
              const active = policyFilter === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPolicyFilter(opt.key)}
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

          <div style={{ width: 1, height: 28, backgroundColor: T.border, margin: "0 4px" }} />

          <select
            value={pipelineFilter}
            onChange={(e) => { setPipelineFilter(e.target.value); setStageFilter("all"); }}
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
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

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
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
          </select>

          <div style={{ width: 1, height: 28, backgroundColor: T.border, margin: "0 4px" }} />

          <select
            value={callCenterFilter}
            onChange={(e) => setCallCenterFilter(e.target.value)}
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
            <option value="all">All Call Centers</option>
            {callCenters.map((cc) => (
              <option key={cc.id} value={cc.id}>{cc.name}</option>
            ))}
          </select>

          <div style={{ width: 1, height: 28, backgroundColor: T.border, margin: "0 4px" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>Created:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                height: 38,
                padding: "0 10px",
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 500,
                color: T.textDark,
                background: T.cardBg,
                outline: "none",
                cursor: "pointer",
                fontFamily: T.font,
              }}
            />
            <span style={{ fontSize: 12, color: T.textMuted }}>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                height: 38,
                padding: "0 10px",
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 500,
                color: T.textDark,
                background: T.cardBg,
                outline: "none",
                cursor: "pointer",
                fontFamily: T.font,
              }}
            />
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                style={{
                  height: 28,
                  padding: "0 8px",
                  borderRadius: 6,
                  border: "none",
                  background: "#fef2f2",
                  color: "#dc2626",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Clear
              </button>
            )}
          </div>

          <div style={{ width: 1, height: 28, backgroundColor: T.border, margin: "0 4px" }} />

          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={16} style={{ position: "absolute", left: 12, pointerEvents: "none", zIndex: 1, color: T.textMuted }} />
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
            />
          </div>
        </div>
      </div>

      {selectedLeadIds.size > 0 && (
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
              {selectedLeadIds.size}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#233217" }}>
              {selectedLeadIds.size === 1 ? "lead selected" : "leads selected"}
            </span>
            <button
              type="button"
              onClick={clearSelection}
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
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => { void bulkSetSync(true); }}
              disabled={bulkSyncing}
              style={{
                height: 36,
                padding: "0 14px",
                borderRadius: 10,
                border: "1px solid #233217",
                background: "#233217",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: bulkSyncing ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: T.font,
                opacity: bulkSyncing ? 0.6 : 1,
              }}
            >
              Enable sync
            </button>
            <button
              type="button"
              onClick={() => { void bulkSetSync(false); }}
              disabled={bulkSyncing}
              style={{
                height: 36,
                padding: "0 14px",
                borderRadius: 10,
                border: "1px solid #647864",
                background: "transparent",
                color: "#233217",
                fontSize: 12,
                fontWeight: 700,
                cursor: bulkSyncing ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: T.font,
                opacity: bulkSyncing ? 0.6 : 1,
              }}
            >
              Disable sync
            </button>
            {noPolicySelectedCount > 0 && (
              <button
                type="button"
                onClick={() => { void openBulkSyncPreview(); }}
                disabled={bulkSyncing}
                style={{
                  height: 36,
                  padding: "0 14px",
                  borderRadius: 10,
                  border: "none",
                  background: "#16a34a",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: bulkSyncing ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: T.font,
                  opacity: bulkSyncing ? 0.6 : 1,
                  boxShadow: "0 2px 8px rgba(22, 163, 74, 0.3)",
                }}
              >
                <RefreshCw size={12} />
                Bulk sync from Deal Tracker
              </button>
            )}
          </div>
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
          <div style={{ padding: "80px 40px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
            <LoadingSpinner size={48} label="Loading leads…" />
          </div>
        ) : paginated.length === 0 ? (
          <div style={{ padding: "60px 40px", textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.textMuted, marginBottom: 8 }}>
              {leads.length === 0 ? "No leads found" : "No matching leads"}
            </div>
            <div style={{ fontSize: 14, color: T.textMid }}>
              {leads.length === 0 ? "No leads match the current filters." : "Try adjusting your search or filter criteria."}
            </div>
          </div>
        ) : (
          <>
            <div style={{ borderBottom: `1px solid ${T.border}`, overflow: "hidden", backgroundColor: T.cardBg }}>
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
                      {noPolicyFiltered.length > 0 && (
                        <input
                          type="checkbox"
                          checked={pageNoPolicyAllSelected}
                          onChange={(e) => toggleSelectAllVisibleNoPolicy(e.target.checked)}
                          style={{ width: 16, height: 16, accentColor: "#fff", cursor: "pointer" }}
                          title={pageNoPolicyAllSelected ? "Deselect all" : "Select all no-policy on page"}
                        />
                      )}
                    </TableHead>
                    {[
                      { label: "S.No", align: "left" as const },
                      { label: "Lead", align: "left" as const },
                      { label: "Phone", align: "left" as const },
                      { label: "Policy #", align: "left" as const },
                      { label: "Carrier", align: "left" as const },
                      { label: "Call Center", align: "left" as const },
                      { label: "Stage", align: "left" as const },
                      { label: "Created", align: "left" as const },
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
                  {paginated.map((row, i) => {
                    const isNoPolicy = !row.policyNumber;
                    const isSelected = selectedLeadIds.has(row.leadId);
                    return (
                      <TableRow
                        key={row.leadId}
                        style={{
                          borderBottom: `1px solid ${T.border}`,
                          backgroundColor: isSelected ? "#eef5ee" : undefined,
                        }}
                        className="hover:bg-muted/30 transition-all duration-150"
                      >
                        <TableCell style={{ padding: "14px 14px 14px 20px", width: 40 }}>
                          {isNoPolicy && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => toggleLeadSelection(row.leadId, e.target.checked)}
                              style={{ width: 16, height: 16, accentColor: "#233217", cursor: "pointer" }}
                            />
                          )}
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
                                color: "#233217",
                                fontFamily: "monospace",
                                backgroundColor: "#eef5ee",
                                padding: "4px 10px",
                                borderRadius: 6,
                              }}
                            >
                              {row.policyNumber}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: "#d97706",
                                backgroundColor: "#fef3c7",
                                padding: "4px 10px",
                                borderRadius: 6,
                              }}
                            >
                              No policy
                            </span>
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
                          {row.callCenterName ? (
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
                              {row.callCenterName}
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
                          {row.createdAt ? (
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: T.textMid,
                              }}
                            >
                              {new Date(row.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          ) : (
                            <span style={{ color: T.textMuted, fontSize: 13 }}>—</span>
                          )}
                        </TableCell>
                        <TableCell style={{ padding: "14px 20px", textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() => openAttachModal(row)}
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
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#3b5229"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#233217"; }}
                          >
                            <Link2 size={14} />
                            {row.policyNumber ? "Edit" : "Attach"}
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

      {selectedLead && (
        <div
          onClick={closeAttachModal}
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
              maxWidth: 480,
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
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: T.textMuted, marginBottom: 6 }}>
                  Policy Attachment
                </div>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#233217", letterSpacing: "-0.01em" }}>
                  {selectedLead.fullName}
                </h3>
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#233217", fontFamily: "monospace", backgroundColor: "#eef5ee", padding: "3px 8px", borderRadius: 6 }}>
                    {selectedLead.policyNumber || "No policy"}
                  </span>
                  {selectedLead.carrier && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#233217", backgroundColor: "#DCEBDC", padding: "3px 8px", borderRadius: 6 }}>
                      {selectedLead.carrier}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={closeAttachModal}
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
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: "20px 28px 24px" }}>
              {attachError && (
                <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 12, background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>
                  {attachError}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 8 }}>
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
                    fontFamily: "monospace",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <Card
                style={{
                  padding: "16px",
                  borderRadius: 12,
                  background: "#fafdf8",
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 8 }}>Lead Details</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                  <div><span style={{ color: T.textMuted }}>Phone: </span><span style={{ fontWeight: 600 }}>{formatPhone(selectedLead.phone) || "—"}</span></div>
                  <div><span style={{ color: T.textMuted }}>Stage: </span><span style={{ fontWeight: 600 }}>{selectedLead.stage || "—"}</span></div>
                  <div><span style={{ color: T.textMuted }}>Lead Value: </span><span style={{ fontWeight: 600 }}>{selectedLead.leadValue != null ? `$${selectedLead.leadValue.toLocaleString()}` : "—"}</span></div>
                  <div><span style={{ color: T.textMuted }}>Sync Required: </span><span style={{ fontWeight: 600 }}>{selectedLead.syncRequired ? "Yes" : "No"}</span></div>
                </div>
              </Card>
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
                onClick={closeAttachModal}
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
                }}
              >
                Cancel
              </button>
              <button
                type="button"
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
                  opacity: attaching ? 0.6 : 1,
                }}
              >
                {attaching ? (
                  <>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", animation: "spin 0.8s linear infinite" }} />
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
          </div>
        </div>
      )}

      {bulkPreviewOpen && (
        <div
          onClick={() => { if (!bulkPreviewSaving) setBulkPreviewOpen(false); }}
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
              maxWidth: 1200,
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
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#233217" }}>
                  Bulk Sync Preview
                </h3>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: T.textMuted, fontWeight: 500 }}>
                  Matched leads from Deal Tracker. Review and save to attach policy numbers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBulkPreviewOpen(false)}
                disabled={bulkPreviewSaving}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 6,
                  borderRadius: 8,
                  cursor: bulkPreviewSaving ? "not-allowed" : "pointer",
                  color: T.textMuted,
                  opacity: bulkPreviewSaving ? 0.4 : 1,
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: "16px 28px 20px" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
                {(
                  [
                    { key: "all" as const, label: `All (${bulkPreviewRows.length})`, color: "#233217" },
                    { key: "different" as const, label: `Different (${bulkPreviewViewRows.length})`, color: "#d97706" },
                  ]
                ).map((tab) => {
                  const active = bulkPreviewView === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => { setBulkPreviewView(tab.key); setBulkPreviewPage(1); }}
                      style={{
                        height: 38,
                        padding: "0 16px",
                        borderRadius: 10,
                        border: active ? `2px solid ${tab.color}` : `1px solid ${T.border}`,
                        background: active ? `${tab.color}12` : T.cardBg,
                        color: active ? tab.color : T.textMid,
                        fontSize: 13,
                        fontWeight: active ? 800 : 600,
                        cursor: "pointer",
                        fontFamily: T.font,
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {bulkPreviewViewRows.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: T.textMuted }}>
                  No rows match the current filter.
                </div>
              ) : (
                <>
                  <ShadcnTable>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{ width: 50, textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={bulkPreviewRows.every((r) => r.selected)}
                            onChange={(e) => setBulkPreviewRows((prev) => prev.map((r) => ({ ...r, selected: e.target.checked })))}
                            style={{ width: 18, height: 18, cursor: "pointer" }}
                          />
                        </TableHead>
                        <TableHead style={{ width: 60 }}></TableHead>
                        <TableHead>Lead Name (CRM)</TableHead>
                        <TableHead>GHL Name (DT)</TableHead>
                        <TableHead>Policy ID (DT)</TableHead>
                        <TableHead>Call Center (CRM)</TableHead>
                        <TableHead>Call Center (DT)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bulkPreviewPaginatedRows.map((row) => (
                        <TableRow key={row.leadId}>
                          <TableCell style={{ textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={row.selected ?? true}
                              onChange={(e) => setBulkPreviewRows((prev) => prev.map((r) => (r.leadId === row.leadId ? { ...r, selected: e.target.checked } : r)))}
                              style={{ width: 18, height: 18, cursor: "pointer" }}
                            />
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => removePreviewLead(row.leadId)}
                              title="Remove lead"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                border: "none",
                                background: "#fef2f2",
                                color: "#dc2626",
                                cursor: "pointer",
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </TableCell>
                          <TableCell style={{ fontWeight: 700 }}>{row.leadNameCrm}</TableCell>
                          <TableCell>{row.leadNameDt}</TableCell>
                          <TableCell style={{ fontFamily: "monospace", fontSize: 12, color: "#16a34a", fontWeight: 700 }}>
                            {row.policyIdDt || "—"}
                          </TableCell>
                          <TableCell>{row.callCenterCrm || "—"}</TableCell>
                          <TableCell>{row.callCenterDt || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </ShadcnTable>
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>
                      Showing {(bulkPreviewPage - 1) * BULK_PREVIEW_ITEMS_PER_PAGE + 1}–{Math.min(bulkPreviewPage * BULK_PREVIEW_ITEMS_PER_PAGE, bulkPreviewViewRows.length)} of {bulkPreviewViewRows.length}
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setBulkPreviewPage((p) => Math.max(1, p - 1))}
                        disabled={bulkPreviewPage <= 1}
                        style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.border}`, cursor: bulkPreviewPage <= 1 ? "not-allowed" : "pointer", opacity: bulkPreviewPage <= 1 ? 0.5 : 1 }}
                      >
                        Previous
                      </button>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>
                        Page {bulkPreviewPage} of {bulkPreviewTotalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setBulkPreviewPage((p) => Math.min(bulkPreviewTotalPages, p + 1))}
                        disabled={bulkPreviewPage >= bulkPreviewTotalPages}
                        style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.border}`, cursor: bulkPreviewPage >= bulkPreviewTotalPages ? "not-allowed" : "pointer", opacity: bulkPreviewPage >= bulkPreviewTotalPages ? 0.5 : 1 }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "16px 28px",
                borderTop: `1px solid ${T.borderLight}`,
                background: "#fafaf7",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {bulkPreviewPage < bulkPreviewTotalPages && (
                  <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 500 }}>
                    Review all pages before saving
                  </span>
                )}
                {bulkPreviewPage === bulkPreviewTotalPages && (
                  <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 600 }}>
                    {bulkPreviewRows.filter((r) => r.selected).length} leads selected to save
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {bulkPreviewPage < bulkPreviewTotalPages ? (
                  <button
                    type="button"
                    onClick={() => setBulkPreviewPage(bulkPreviewTotalPages)}
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
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: "0 4px 14px rgba(35, 50, 23, 0.25)",
                    }}
                  >
                    Go to Last Page
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setBulkPreviewOpen(false)}
                      disabled={bulkPreviewSaving}
                      style={{
                        height: 36,
                        padding: "0 16px",
                        borderRadius: 10,
                        border: `1px solid ${T.border}`,
                        background: T.pageBg,
                        color: T.textDark,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: bulkPreviewSaving ? "not-allowed" : "pointer",
                        fontFamily: T.font,
                        opacity: bulkPreviewSaving ? 0.6 : 1,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveBulkPreviewToDb}
                      disabled={bulkPreviewSaving || bulkPreviewRows.length === 0}
                      style={{
                        height: 36,
                        padding: "0 18px",
                        borderRadius: 10,
                        border: "none",
                        background: "#233217",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: bulkPreviewSaving || bulkPreviewRows.length === 0 ? "not-allowed" : "pointer",
                        fontFamily: T.font,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        opacity: bulkPreviewSaving || bulkPreviewRows.length === 0 ? 0.55 : 1,
                        boxShadow: "0 4px 14px rgba(35, 50, 23, 0.25)",
                      }}
                    >
                      {bulkPreviewSaving ? (
                        <>
                          <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", animation: "spin 0.8s linear infinite" }} />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={14} />
                          Save {bulkPreviewRows.filter((r) => r.selected).length} leads
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}