"use client";

import { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { ActionMenu, DataGrid, FilterChip, Pagination, Table, Toast, EmptyState } from "@/components/ui";
import TransferLeadApplicationForm, { type TransferLeadFormData } from "./TransferLeadApplicationForm";
import LeadViewComponent from "./LeadViewComponent";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCurrentUserPrimaryRole } from "@/lib/auth/user-role";

type IntakeLead = {
  rowId: string;
  id: string;
  name: string;
  phone: string;
  premium: number;
  type: string;
  source: string;
  centerName: string;
  pipeline: string;
  stage: string;
  createdBy: string;
  createdAt: string;
  isDraft?: boolean;
};

type DuplicateLeadMatch = {
  id: string;
  lead_unique_id: string | null;
  first_name: string | null;
  last_name: string | null;
  stage: string | null;
};

const FIXED_BPO_LEAD_SOURCE = "BPO Transfer Lead Source";

// ── Color maps matching the DailyDealFlow style ─────────────────────────────
const TYPE_CONFIG: Record<string, { bg: string; color: string }> = {
  "Preferred":  { bg: "#eff6ff", color: "#2563eb" },
  "Standard":   { bg: "#f0fdf4", color: "#16a34a" },
  "Graded":     { bg: "#fdf4ff", color: "#9333ea" },
  "Modified":   { bg: "#fff7ed", color: "#ea580c" },
  "GI":         { bg: "#fef9c3", color: "#ca8a04" },
  "Immediate":  { bg: "#fdf4ff", color: "#d946ef" },
  "Level":      { bg: "#f0fdf4", color: "#059669" },
  "ROP":        { bg: "#f8fafc", color: "#475569" },
  "Transfer":   { bg: "#eff6ff", color: "#2563eb" },
};

const getTypeConfig = (type: string) =>
  TYPE_CONFIG[type] ?? { bg: T.blueFaint, color: T.blue };

// Generate a consistent avatar color from a string
function stringToColor(str: string) {
  const colors = [T.blue, "#ec4899", "#8b5cf6", "#0ea5e9", "#f59e0b", "#f97316", "#14b8a6", "#64748b"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function buildLeadUniqueId(payload: TransferLeadFormData): string {
  const namePart = `${payload.firstName}${payload.lastName}`.toLowerCase().replace(/[^a-z0-9]/g, "");
  const phoneDigits = payload.phone.replace(/\D/g, "");
  const socialDigits = payload.social.replace(/\D/g, "");
  const phoneLast4 = phoneDigits.slice(-4);
  const socialLast4 = socialDigits.slice(-4);
  return `${namePart}-${phoneLast4}-${socialLast4}`;
}

export default function CallCenterLeadIntakePage({ canCreateLeads = true }: { canCreateLeads?: boolean }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [leads, setLeads] = useState<IntakeLead[]>([]);
  const [viewingLead, setViewingLead] = useState<{ id: string; name: string } | null>(null);
  const [editingLead, setEditingLead] = useState<{ rowId: string; formData: TransferLeadFormData } | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterSource, setFilterSource] = useState("All");
  const [page, setPage] = useState(1);
  const [showCreateLead, setShowCreateLead] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [defaultTransferStageId, setDefaultTransferStageId] = useState<number | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [pendingCreatePayload, setPendingCreatePayload] = useState<TransferLeadFormData | null>(null);
  const [duplicateLeadMatch, setDuplicateLeadMatch] = useState<DuplicateLeadMatch | null>(null);
  const [callCenterName, setCallCenterName] = useState("");
  const itemsPerPage = 10;

  useEffect(() => {
    let cancelled = false;
    const loadCallCenterName = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        if (!cancelled) setCallCenterName("");
        return;
      }
      const { data } = await supabase
        .from("users")
        .select("call_centers(name)")
        .eq("id", session.user.id)
        .maybeSingle();
      const row = data as { call_centers?: { name?: string } | null } | null;
      const name = row?.call_centers?.name;
      if (!cancelled) setCallCenterName(typeof name === "string" ? name.trim() : "");
    };
    void loadCallCenterName();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const refreshLeads = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      setLeads([]);
      return;
    }

    const { data: userProfile } = await supabase
      .from("users")
      .select("full_name, call_center_id")
      .eq("id", session.user.id)
      .maybeSingle();

    const role = await getCurrentUserPrimaryRole(supabase, session.user.id);

    const baseQuery = supabase
      .from("leads")
      .select("id, lead_unique_id, first_name, last_name, phone, lead_value, product_type, lead_source, pipeline, stage, stage_id, call_center_id, created_at, is_draft, call_centers(name), users!submitted_by(full_name)")
      .order("created_at", { ascending: false });

    const query = role === "call_center_admin" && userProfile?.call_center_id
      ? baseQuery.eq("call_center_id", userProfile.call_center_id)
      : baseQuery.eq("submitted_by", session.user.id);

    const { data, error } = await query;

    if (error) {
      setToast({ message: error.message || "Failed to load leads", type: "error" });
      return;
    }

    const mapped: IntakeLead[] = (data || []).map((lead: any) => ({
      rowId: lead.id,
      id: lead.lead_unique_id || "N/A",
      name: `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "Unnamed Lead",
      phone: lead.phone || "",
      premium: Number(lead.lead_value) || 0,
      type: lead.product_type || "Transfer",
      source: lead.lead_source || "Unknown",
      centerName: lead.call_centers?.name || "Unassigned",
      pipeline: lead.pipeline || "Transfer Portal",
      stage: lead.stage || "Transfer API",
      createdBy: lead.users?.full_name?.trim() || "Unknown",
      createdAt: lead.created_at ? new Date(lead.created_at).toLocaleString() : "Just now",
      isDraft: lead.is_draft ?? false,
    }));

    setLeads(mapped);
  };

  useEffect(() => {
    refreshLeads();
  }, [supabase]);

  useEffect(() => {
    const fetchDefaultTransferStage = async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("id")
        .eq("name", "Transfer Portal")
        .maybeSingle();

      if (error || !data?.id) return;

      const { data: stageData, error: stageError } = await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("pipeline_id", data.id)
        .eq("name", "Transfer API")
        .maybeSingle();

      if (!stageError && stageData?.id) {
        setDefaultTransferStageId(stageData.id);
      }
    };

    void fetchDefaultTransferStage();
  }, [supabase]);

  const types = Array.from(new Set(leads.map((lead) => lead.type)));
  const sources = Array.from(new Set(leads.map((lead) => lead.source)));

  const filtered = leads.filter((lead) => {
    const matchType = filterType === "All" || lead.type === filterType;
    const matchSource = filterSource === "All" || lead.source === filterSource;
    const query = search.toLowerCase().trim();
    const matchSearch =
      !query ||
      lead.name.toLowerCase().includes(query) ||
      lead.phone.toLowerCase().includes(query) ||
      lead.id.toLowerCase().includes(query);
    return matchType && matchSource && matchSearch;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  useEffect(() => { setPage(1); }, [search, filterType, filterSource]);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(totalPages);
    if (filtered.length === 0 && page !== 1) setPage(1);
  }, [filtered.length, page, totalPages]);

  // Stats
  const totalPremium = leads.reduce((s, l) => s + l.premium, 0);
  const avgPremium = leads.length ? totalPremium / leads.length : 0;
  const uniquePipelines = new Set(leads.map((l) => l.pipeline)).size;

  const handleCreateLead = async (payload: TransferLeadFormData) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      setToast({ message: "You are not logged in", type: "error" });
      return;
    }

    const { data: userProfile } = await supabase
      .from("users")
      .select("call_center_id")
      .eq("id", session.user.id)
      .maybeSingle();

    const leadUniqueId = payload.leadUniqueId || buildLeadUniqueId(payload);

    const normalizeSsn = (value: string) => value.replace(/\D/g, "");
    const ssnDigits = normalizeSsn(payload.social || "");

    const findDuplicateBySsn = async () => {
      if (ssnDigits.length !== 9) return null;
      const variants = Array.from(new Set([payload.social?.trim(), ssnDigits, `${ssnDigits.slice(0, 3)}-${ssnDigits.slice(3, 5)}-${ssnDigits.slice(5)}`].filter(Boolean)));
      const { data: existing, error: existingError } = await supabase
        .from("leads")
        .select("id, lead_unique_id, first_name, last_name, stage, social, created_at")
        .in("social", variants)
        .order("created_at", { ascending: false });
      if (existingError) return null;
      return (existing || []).find((row: any) => normalizeSsn(String(row.social || "")) === ssnDigits) || null;
    };

    const existingLead = await findDuplicateBySsn();
    if (existingLead) {
      setPendingCreatePayload(payload);
      setDuplicateLeadMatch({
        id: existingLead.id,
        lead_unique_id: existingLead.lead_unique_id ?? null,
        first_name: existingLead.first_name ?? null,
        last_name: existingLead.last_name ?? null,
        stage: existingLead.stage ?? null,
      });
      setShowDuplicateDialog(true);
      return;
    }

    const insertLead = async (finalPayload: TransferLeadFormData, asDuplicate: boolean) => {
      const existingAdditional = (finalPayload.additionalInformation || "").trim();
      return supabase.from("leads").insert({
        lead_unique_id: leadUniqueId,
        lead_value: Number(finalPayload.leadValue || 0),
        lead_source: FIXED_BPO_LEAD_SOURCE,
        submission_date: finalPayload.submissionDate,
        first_name: finalPayload.firstName,
        last_name: finalPayload.lastName,
        street1: finalPayload.street1,
        street2: finalPayload.street2 || null,
        city: finalPayload.city,
        state: finalPayload.state,
        zip_code: finalPayload.zipCode,
        phone: finalPayload.phone,
        birth_state: finalPayload.birthState,
        date_of_birth: finalPayload.dateOfBirth,
        age: finalPayload.age,
        social: finalPayload.social,
        driver_license_number: finalPayload.driverLicenseNumber,
        existing_coverage_last_2_years: finalPayload.existingCoverageLast2Years,
        previous_applications_2_years: finalPayload.previousApplications2Years,
        height: finalPayload.height,
        weight: finalPayload.weight,
        doctor_name: finalPayload.doctorName,
        tobacco_use: finalPayload.tobaccoUse,
        health_conditions: finalPayload.healthConditions,
        medications: finalPayload.medications,
        monthly_premium: finalPayload.monthlyPremium,
        coverage_amount: finalPayload.coverageAmount,
        carrier: finalPayload.carrier,
        product_type: finalPayload.productType,
        draft_date: finalPayload.draftDate,
        beneficiary_information: finalPayload.beneficiaryInformation,
        bank_account_type: finalPayload.bankAccountType || null,
        institution_name: finalPayload.institutionName,
        routing_number: finalPayload.routingNumber,
        account_number: finalPayload.accountNumber,
        future_draft_date: finalPayload.futureDraftDate,
        additional_information: existingAdditional || null,
        tags: asDuplicate ? ["duplicate"] : [],
        pipeline: finalPayload.pipeline || "Transfer Portal",
        stage: finalPayload.stage || "Transfer API",
        stage_id: defaultTransferStageId,
        is_draft: false,
        call_center_id: userProfile?.call_center_id || null,
        submitted_by: session.user.id,
      });
    };

    const { error } = await insertLead(payload, false);

    if (error) {
      setToast({ message: error.message || "Failed to save lead", type: "error" });
      return;
    }

    setToast({ message: "Lead saved successfully", type: "success" });
    setShowCreateLead(false);
    setPage(1);
    await refreshLeads();
  };

  const handleCreateDuplicateLead = async () => {
    if (!pendingCreatePayload) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      setToast({ message: "You are not logged in", type: "error" });
      return;
    }

    const { data: userProfile } = await supabase
      .from("users")
      .select("call_center_id")
      .eq("id", session.user.id)
      .maybeSingle();

    const leadUniqueId = pendingCreatePayload.leadUniqueId || buildLeadUniqueId(pendingCreatePayload);
    const existingAdditional = (pendingCreatePayload.additionalInformation || "").trim();

    const { error } = await supabase.from("leads").insert({
      lead_unique_id: leadUniqueId,
      lead_value: Number(pendingCreatePayload.leadValue || 0),
      lead_source: FIXED_BPO_LEAD_SOURCE,
      submission_date: pendingCreatePayload.submissionDate,
      first_name: pendingCreatePayload.firstName,
      last_name: pendingCreatePayload.lastName,
      street1: pendingCreatePayload.street1,
      street2: pendingCreatePayload.street2 || null,
      city: pendingCreatePayload.city,
      state: pendingCreatePayload.state,
      zip_code: pendingCreatePayload.zipCode,
      phone: pendingCreatePayload.phone,
      birth_state: pendingCreatePayload.birthState,
      date_of_birth: pendingCreatePayload.dateOfBirth,
      age: pendingCreatePayload.age,
      social: pendingCreatePayload.social,
      driver_license_number: pendingCreatePayload.driverLicenseNumber,
      existing_coverage_last_2_years: pendingCreatePayload.existingCoverageLast2Years,
      previous_applications_2_years: pendingCreatePayload.previousApplications2Years,
      height: pendingCreatePayload.height,
      weight: pendingCreatePayload.weight,
      doctor_name: pendingCreatePayload.doctorName,
      tobacco_use: pendingCreatePayload.tobaccoUse,
      health_conditions: pendingCreatePayload.healthConditions,
      medications: pendingCreatePayload.medications,
      monthly_premium: pendingCreatePayload.monthlyPremium,
      coverage_amount: pendingCreatePayload.coverageAmount,
      carrier: pendingCreatePayload.carrier,
      product_type: pendingCreatePayload.productType,
      draft_date: pendingCreatePayload.draftDate,
      beneficiary_information: pendingCreatePayload.beneficiaryInformation,
      bank_account_type: pendingCreatePayload.bankAccountType || null,
      institution_name: pendingCreatePayload.institutionName,
      routing_number: pendingCreatePayload.routingNumber,
      account_number: pendingCreatePayload.accountNumber,
      future_draft_date: pendingCreatePayload.futureDraftDate,
      additional_information: existingAdditional || null,
      tags: ["duplicate"],
      pipeline: pendingCreatePayload.pipeline || "Transfer Portal",
      stage: pendingCreatePayload.stage || "Transfer API",
      stage_id: defaultTransferStageId,
      is_draft: false,
      call_center_id: userProfile?.call_center_id || null,
      submitted_by: session.user.id,
    });

    if (error) {
      setToast({ message: error.message || "Failed to save duplicate lead", type: "error" });
      return;
    }

    setShowDuplicateDialog(false);
    setPendingCreatePayload(null);
    setDuplicateLeadMatch(null);
    setToast({ message: "Duplicate lead saved with duplicate tag", type: "success" });
    setShowCreateLead(false);
    setPage(1);
    await refreshLeads();
  };

  const handleEditExistingDuplicateLead = async () => {
    if (!duplicateLeadMatch?.id) return;
    setShowDuplicateDialog(false);
    setPendingCreatePayload(null);
    const existingId = duplicateLeadMatch.id;
    setDuplicateLeadMatch(null);
    setShowCreateLead(false);
    await handleEditLead(existingId);
  };

  const handleCreateDraftLead = async (payload: TransferLeadFormData) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      setToast({ message: "You are not logged in", type: "error" });
      return;
    }

    const { data: userProfile } = await supabase
      .from("users")
      .select("call_center_id")
      .eq("id", session.user.id)
      .maybeSingle();

    const leadUniqueId = payload.leadUniqueId || buildLeadUniqueId(payload);

    const { error } = await supabase.from("leads").insert({
      lead_unique_id: leadUniqueId,
      lead_value: Number(payload.leadValue || 0),
      lead_source: FIXED_BPO_LEAD_SOURCE,
      submission_date: payload.submissionDate || null,
      first_name: payload.firstName || null,
      last_name: payload.lastName || null,
      street1: payload.street1 || null,
      street2: payload.street2 || null,
      city: payload.city || null,
      state: payload.state || null,
      zip_code: payload.zipCode || null,
      phone: payload.phone || null,
      birth_state: payload.birthState || null,
      date_of_birth: payload.dateOfBirth || null,
      age: payload.age || null,
      social: payload.social || null,
      driver_license_number: payload.driverLicenseNumber || null,
      existing_coverage_last_2_years: payload.existingCoverageLast2Years || null,
      previous_applications_2_years: payload.previousApplications2Years || null,
      height: payload.height || null,
      weight: payload.weight || null,
      doctor_name: payload.doctorName || null,
      tobacco_use: payload.tobaccoUse || null,
      health_conditions: payload.healthConditions || null,
      medications: payload.medications || null,
      monthly_premium: payload.monthlyPremium || null,
      coverage_amount: payload.coverageAmount || null,
      carrier: payload.carrier || null,
      product_type: payload.productType || null,
      draft_date: payload.draftDate || null,
      beneficiary_information: payload.beneficiaryInformation || null,
      bank_account_type: payload.bankAccountType || null,
      institution_name: payload.institutionName || null,
      routing_number: payload.routingNumber || null,
      account_number: payload.accountNumber || null,
      future_draft_date: payload.futureDraftDate || null,
      additional_information: payload.additionalInformation || null,
      pipeline: payload.pipeline || "Transfer Portal",
      stage: payload.stage || "Transfer API",
      stage_id: defaultTransferStageId,
      is_draft: true,
      call_center_id: userProfile?.call_center_id || null,
      submitted_by: session.user.id,
    });

    if (error) {
      setToast({ message: error.message || "Failed to save draft", type: "error" });
      return;
    }

    setToast({ message: "Draft saved", type: "success" });
    setShowCreateLead(false);
    setPage(1);
    await refreshLeads();
  };

  const handleEditLead = async (rowId: string) => {
    const { data, error } = await supabase
      .from("leads")
      .select("id, lead_unique_id, lead_value, lead_source, submission_date, first_name, last_name, street1, street2, city, state, zip_code, phone, birth_state, date_of_birth, age, social, driver_license_number, existing_coverage_last_2_years, previous_applications_2_years, height, weight, doctor_name, tobacco_use, health_conditions, medications, monthly_premium, coverage_amount, carrier, product_type, draft_date, beneficiary_information, bank_account_type, institution_name, routing_number, account_number, future_draft_date, additional_information, pipeline, stage, is_draft")
      .eq("id", rowId)
      .maybeSingle();

    if (error || !data) {
      setToast({ message: error?.message || "Failed to load lead for editing", type: "error" });
      return;
    }

    const mapped: TransferLeadFormData = {
      leadUniqueId: data.lead_unique_id || "",
      leadValue: data.lead_value != null ? String(data.lead_value) : "",
      leadSource: FIXED_BPO_LEAD_SOURCE,
      submissionDate: data.submission_date || "",
      firstName: data.first_name || "",
      lastName: data.last_name || "",
      street1: data.street1 || "",
      street2: data.street2 || "",
      city: data.city || "",
      state: data.state || "",
      zipCode: data.zip_code || "",
      phone: data.phone || "",
      birthState: data.birth_state || "",
      dateOfBirth: data.date_of_birth || "",
      age: data.age || "",
      social: data.social || "",
      driverLicenseNumber: data.driver_license_number || "",
      existingCoverageLast2Years: data.existing_coverage_last_2_years || "",
      previousApplications2Years: data.previous_applications_2_years || "",
      height: data.height || "",
      weight: data.weight || "",
      doctorName: data.doctor_name || "",
      tobaccoUse: data.tobacco_use || "",
      healthConditions: data.health_conditions || "",
      medications: data.medications || "",
      monthlyPremium: data.monthly_premium || "",
      coverageAmount: data.coverage_amount || "",
      carrier: data.carrier || "",
      productType: data.product_type || "",
      draftDate: data.draft_date || "",
      beneficiaryInformation: data.beneficiary_information || "",
      bankAccountType: data.bank_account_type || "",
      institutionName: data.institution_name || "",
      routingNumber: data.routing_number || "",
      accountNumber: data.account_number || "",
      futureDraftDate: data.future_draft_date || "",
      additionalInformation: data.additional_information || "",
      pipeline: data.pipeline || "Transfer Portal",
      stage: data.stage || "Transfer API",
      isDraft: data.is_draft ?? false,
    };

    setEditingLead({ rowId, formData: mapped });
  };

  const handleUpdateLead = async (payload: TransferLeadFormData) => {
    if (!editingLead?.rowId) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { data: userProfile } = session?.user?.id
      ? await supabase
          .from("users")
          .select("call_center_id")
          .eq("id", session.user.id)
          .maybeSingle()
      : { data: null as { call_center_id?: string | null } | null };

    const { error } = await supabase
      .from("leads")
      .update({
        lead_unique_id: payload.leadUniqueId || buildLeadUniqueId(payload),
        lead_value: Number(payload.leadValue || 0),
        lead_source: FIXED_BPO_LEAD_SOURCE,
        submission_date: payload.submissionDate,
        first_name: payload.firstName,
        last_name: payload.lastName,
        street1: payload.street1,
        street2: payload.street2 || null,
        city: payload.city,
        state: payload.state,
        zip_code: payload.zipCode,
        phone: payload.phone,
        birth_state: payload.birthState,
        date_of_birth: payload.dateOfBirth,
        age: payload.age,
        social: payload.social,
        driver_license_number: payload.driverLicenseNumber,
        existing_coverage_last_2_years: payload.existingCoverageLast2Years,
        previous_applications_2_years: payload.previousApplications2Years,
        height: payload.height,
        weight: payload.weight,
        doctor_name: payload.doctorName,
        tobacco_use: payload.tobaccoUse,
        health_conditions: payload.healthConditions,
        medications: payload.medications,
        monthly_premium: payload.monthlyPremium,
        coverage_amount: payload.coverageAmount,
        carrier: payload.carrier,
        product_type: payload.productType,
        draft_date: payload.draftDate,
        beneficiary_information: payload.beneficiaryInformation,
        bank_account_type: payload.bankAccountType || null,
        institution_name: payload.institutionName,
        routing_number: payload.routingNumber,
        account_number: payload.accountNumber,
        future_draft_date: payload.futureDraftDate,
        additional_information: payload.additionalInformation || null,
        pipeline: payload.pipeline || "Transfer Portal",
        stage: payload.stage || "Transfer API",
        stage_id: defaultTransferStageId,
        is_draft: false,
        call_center_id: userProfile?.call_center_id || null,
      })
      .eq("id", editingLead.rowId);

    if (error) {
      setToast({ message: error.message || "Failed to update lead", type: "error" });
      return;
    }

    setToast({ message: "Lead updated successfully", type: "success" });
    setEditingLead(null);
    await refreshLeads();
  };

  const handleUpdateDraftLead = async (payload: TransferLeadFormData) => {
    if (!editingLead?.rowId) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { data: userProfile } = session?.user?.id
      ? await supabase
          .from("users")
          .select("call_center_id")
          .eq("id", session.user.id)
          .maybeSingle()
      : { data: null as { call_center_id?: string | null } | null };

    const { error } = await supabase
      .from("leads")
      .update({
        lead_unique_id: payload.leadUniqueId || buildLeadUniqueId(payload),
        lead_value: Number(payload.leadValue || 0),
        lead_source: FIXED_BPO_LEAD_SOURCE,
        submission_date: payload.submissionDate || null,
        first_name: payload.firstName || null,
        last_name: payload.lastName || null,
        street1: payload.street1 || null,
        street2: payload.street2 || null,
        city: payload.city || null,
        state: payload.state || null,
        zip_code: payload.zipCode || null,
        phone: payload.phone || null,
        birth_state: payload.birthState || null,
        date_of_birth: payload.dateOfBirth || null,
        age: payload.age || null,
        social: payload.social || null,
        driver_license_number: payload.driverLicenseNumber || null,
        existing_coverage_last_2_years: payload.existingCoverageLast2Years || null,
        previous_applications_2_years: payload.previousApplications2Years || null,
        height: payload.height || null,
        weight: payload.weight || null,
        doctor_name: payload.doctorName || null,
        tobacco_use: payload.tobaccoUse || null,
        health_conditions: payload.healthConditions || null,
        medications: payload.medications || null,
        monthly_premium: payload.monthlyPremium || null,
        coverage_amount: payload.coverageAmount || null,
        carrier: payload.carrier || null,
        product_type: payload.productType || null,
        draft_date: payload.draftDate || null,
        beneficiary_information: payload.beneficiaryInformation || null,
        bank_account_type: payload.bankAccountType || null,
        institution_name: payload.institutionName || null,
        routing_number: payload.routingNumber || null,
        account_number: payload.accountNumber || null,
        future_draft_date: payload.futureDraftDate || null,
        additional_information: payload.additionalInformation || null,
        pipeline: payload.pipeline || "Transfer Portal",
        stage: payload.stage || "Transfer API",
        stage_id: defaultTransferStageId,
        is_draft: true,
        call_center_id: userProfile?.call_center_id || null,
      })
      .eq("id", editingLead.rowId);

    if (error) {
      setToast({ message: error.message || "Failed to save draft", type: "error" });
      return;
    }

    setToast({ message: "Draft updated", type: "success" });
    setEditingLead(null);
    await refreshLeads();
  };

  if (showCreateLead) {
    return (
      <>
        <TransferLeadApplicationForm
          onBack={() => setShowCreateLead(false)}
          onSubmit={handleCreateLead}
          onSaveDraft={handleCreateDraftLead}
          centerName={callCenterName}
        />
        {showDuplicateDialog && duplicateLeadMatch && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ width: "100%", maxWidth: 560, backgroundColor: "#fff", borderRadius: 12, border: `1px solid ${T.border}`, padding: 22, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.textDark }}>Lead already exists</h3>
              <p style={{ marginTop: 10, marginBottom: 14, fontSize: 14, color: T.textMid, lineHeight: 1.5 }}>
                We found an existing lead with the same SSN.
              </p>
              <div style={{ backgroundColor: T.rowBg, border: `1px solid ${T.borderLight}`, borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.textDark }}>
                  {(duplicateLeadMatch.first_name || "")} {(duplicateLeadMatch.last_name || "")}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
                  Lead ID: {duplicateLeadMatch.lead_unique_id || duplicateLeadMatch.id}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted }}>
                  Stage: {duplicateLeadMatch.stage || "Unknown"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => {
                    setShowDuplicateDialog(false);
                    setPendingCreatePayload(null);
                    setDuplicateLeadMatch(null);
                  }}
                  style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleEditExistingDuplicateLead()}
                  style={{ background: "#fff", border: `1px solid ${T.blue}`, color: T.blue, borderRadius: 8, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}
                >
                  Edit Existing
                </button>
                <button
                  onClick={() => void handleCreateDuplicateLead()}
                  style={{ background: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}
                >
                  Create New (Tag Duplicate)
                </button>
              </div>
            </div>
          </div>
        )}
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  if (editingLead) {
    return (
      <>
        <TransferLeadApplicationForm
          onBack={() => setEditingLead(null)}
          onSubmit={handleUpdateLead}
          onSaveDraft={handleUpdateDraftLead}
          initialData={editingLead.formData}
          submitButtonLabel="Update Lead"
          centerName={callCenterName}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  if (viewingLead) {
    return (
      <>
        <LeadViewComponent
          leadId={viewingLead.id}
          leadName={viewingLead.name}
          onBack={() => setViewingLead(null)}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  return (
    <div onClick={() => setActiveMenu(null)}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p style={{ fontSize: 13, color: T.textMuted, fontWeight: 600, margin: "0 0 4px" }}>
            Transfer workflow — {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.textDark, margin: 0 }}>Transfer Leads</h1>
        </div>
        <button
          onClick={() => setShowCreateLead(true)}
          disabled={!canCreateLeads}
          title={!canCreateLeads ? "Missing permission: action.transfer_leads.create" : undefined}
          style={{
            backgroundColor: canCreateLeads ? T.blue : T.border,
            color: "#fff",
            border: "none",
            borderRadius: T.radiusMd,
            padding: "10px 22px",
            fontSize: 13,
            fontWeight: 700,
            cursor: canCreateLeads ? "pointer" : "not-allowed",
            fontFamily: T.font,
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: canCreateLeads ? `0 4px 12px ${T.blue}44` : "none",
            transition: "all 0.15s",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add New Lead
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total Leads", value: leads.length.toString(), color: T.blue },
          { label: "Total Premium Volume", value: `$${totalPremium.toLocaleString()}`, color: "#16a34a" },
          { label: "Avg Premium", value: `$${avgPremium.toFixed(0)}`, color: "#ca8a04" },
          { label: "Active Pipelines", value: uniquePipelines.toString(), color: "#7c3aed" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ backgroundColor: T.cardBg, borderRadius: T.radiusLg, padding: "18px 20px", boxShadow: T.shadowSm, borderLeft: `4px solid ${color}` }}>
            <p style={{ margin: "0 0 6px", fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{label}</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color }}>{value}</p>
          </div>
        ))}
      </div>

      <DataGrid
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search leads by name, phone, source, or ID..."
        filters={
          <>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, color: T.textMid, fontFamily: T.font, cursor: "pointer", backgroundColor: "transparent" }}
            >
              <option value="All">All Types</option>
              {types.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              style={{ padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, color: T.textMid, fontFamily: T.font, cursor: "pointer", backgroundColor: "transparent" }}
            >
              <option value="All">All Sources</option>
              {sources.map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </>
        }
        activeFilters={
          (filterType !== "All" || filterSource !== "All") ? (
            <>
              {filterType !== "All" && <FilterChip label={`Type: ${filterType}`} onClear={() => setFilterType("All")} />}
              {filterSource !== "All" && <FilterChip label={`Source: ${filterSource}`} onClear={() => setFilterSource("All")} />}
              <button
                onClick={() => { setFilterType("All"); setFilterSource("All"); }}
                style={{ background: "none", border: "none", color: T.blue, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: "4px 8px", fontFamily: T.font, marginLeft: "auto" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = "underline")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = "none")}
              >
                Reset All
              </button>
            </>
          ) : null
        }
        pagination={
          <Pagination
            page={page}
            totalItems={filtered.length}
            itemsPerPage={itemsPerPage}
            itemLabel="leads"
            onPageChange={setPage}
          />
        }
      >
        <Table
          data={paginated}
          onRowClick={(lead) => setViewingLead({ id: lead.id, name: lead.name })}
          columns={[
            {
              header: "Lead ID",
              key: "id",
              render: (lead) => (
                <span style={{ fontSize: 12, fontWeight: 700, color: T.blue, textDecoration: "underline" }}>
                  {lead.id}
                </span>
              ),
            },
            {
              header: "Client",
              key: "name",
              render: (lead) => {
                const avatarColor = stringToColor(lead.name);
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      backgroundColor: avatarColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}>
                      {getInitials(lead.name)}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.textDark }}>{lead.name}</span>
                  </div>
                );
              },
            },
            {
              header: "Contact",
              key: "phone",
              render: (lead) => (
                <div>
                  <div style={{ fontSize: 12, color: T.textDark, fontWeight: 700 }}>{lead.phone}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, marginTop: 2 }}>{lead.source}</div>
                </div>
              ),
            },
            {
              header: "Type",
              key: "type",
              render: (lead) => {
                const tc = getTypeConfig(lead.type);
                return (
                  <span style={{
                    backgroundColor: tc.bg,
                    color: tc.color,
                    borderRadius: 6,
                    padding: "3px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                  }}>
                    {lead.type}
                  </span>
                );
              },
            },
            {
              header: "Centre",
              key: "centerName",
              render: (lead) => (
                <span style={{ fontSize: 12, color: T.textMid, fontWeight: 700 }}>
                  {lead.centerName}
                </span>
              ),
            },
            {
              header: "Pipeline",
              key: "pipeline",
              render: (lead) => (
                <div>
                  <div style={{ fontSize: 12, color: T.textDark, fontWeight: 700 }}>{lead.pipeline}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, marginTop: 2 }}>{lead.stage}</div>
                </div>
              ),
            },
            {
              header: "Premium",
              key: "premium",
              render: (lead) => (
                <span style={{ fontSize: 13, fontWeight: 800, color: T.textDark }}>
                  ${lead.premium.toLocaleString()}
                </span>
              ),
            },
            {
              header: "Created By",
              key: "createdBy",
              render: (lead) => (
                <span style={{ fontSize: 12, color: T.textMid, fontWeight: 700 }}>
                  {lead.createdBy}
                </span>
              ),
            },
            {
              header: "Created",
              key: "createdAt",
              render: (lead) => (
                <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>
                  {lead.createdAt}
                </span>
              ),
            },
            {
              header: "Actions",
              key: "actions",
              align: "center",
              render: (lead) => (
                <div onClick={(e) => e.stopPropagation()}>
                  <ActionMenu
                    id={lead.id}
                    activeId={activeMenu}
                    onToggle={setActiveMenu}
                    items={[
                      { label: "View Details", onClick: () => setViewingLead({ id: lead.id, name: lead.name }) },
                      { label: "Edit Lead", onClick: () => void handleEditLead(lead.rowId) },
                      { label: "Delete", danger: true },
                    ]}
                  />
                </div>
              ),
            },
          ]}
        />
        {filtered.length === 0 && (
          <EmptyState title="No leads found" description="Try changing your search or filter selections." compact />
        )}
      </DataGrid>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
