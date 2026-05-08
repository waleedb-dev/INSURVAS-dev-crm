"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FocusEvent } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ClipboardCopy, Loader2, Search, ShieldAlert, Trash2, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";
import { LeadCard, InfoField, InfoGrid, formatDate } from "@/components/dashboard/pages/LeadCard";
import BpoCentreLeadOnboardingForm from "@/components/dashboard/pages/BpoCentreLeadOnboardingForm";
import { bpoRegionForCountry } from "@/lib/bpoRegionCountry";
import { Toast } from "@/components/ui";

const BRAND_GREEN = "#233217";

function StyledSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  disabled = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(val) => onValueChange(val || "")} disabled={disabled}>
      <SelectTrigger
        disabled={disabled}
        style={{
          width: "100%",
          minWidth: 140,
          height: 38,
          flexShrink: 0,
          borderRadius: 10,
          border: `1px solid ${T.border}`,
          backgroundColor: T.cardBg,
          color: value ? T.textDark : T.textMuted,
          fontSize: 13,
          fontWeight: 500,
          paddingLeft: 14,
          paddingRight: 12,
          transition: "all 0.15s ease-in-out",
          position: "relative",
          zIndex: 1,
          opacity: disabled ? 0.65 : 1,
        }}
        className="hover:border-[#233217] focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
      >
        <SelectValue placeholder={placeholder}>
          {value ? options.find((o) => o.value === value)?.label || value : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        style={{
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          backgroundColor: T.cardBg,
          padding: 6,
          maxHeight: 300,
          zIndex: 50,
        }}
      >
        {options.map((option) => (
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
            className="hover:bg-[#DCEBDC] hover:text-[#233217] focus:bg-[#DCEBDC] focus:text-[#233217] data-[state=checked]:bg-[#233217] data-[state=checked]:text-white data-[state=checked]:font-semibold"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type CenterLeadStage =
  | "pre_onboarding"
  | "ready_for_onboarding_meeting"
  | "onboarding_completed"
  | "actively_selling"
  | "needs_attention"
  | "on_pause"
  | "dqed"
  | "offboarded";

type DetailTab = "Overview" | "Centre & Team setup" | "Resources" | "Credentials";

const STAGE_OPTIONS: { key: CenterLeadStage; label: string }[] = [
  { key: "pre_onboarding", label: "Pre-onboarding" },
  { key: "ready_for_onboarding_meeting", label: "Ready for onboarding meeting" },
  { key: "onboarding_completed", label: "Onboarding completed" },
  { key: "actively_selling", label: "Actively selling" },
  { key: "needs_attention", label: "Needs attention" },
  { key: "on_pause", label: "On pause" },
  { key: "dqed", label: "DQED" },
  { key: "offboarded", label: "Offboarded" },
];

const STAGE_LABEL: Record<string, string> = Object.fromEntries(STAGE_OPTIONS.map((o) => [o.key, o.label]));

function formatCallResultLabel(key: string | null): string {
  if (!key) return "";
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const fieldStyle: CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: `1px solid ${T.border}`,
  fontSize: 13,
  fontWeight: 600,
  color: T.textDark,
  outline: "none",
  fontFamily: T.font,
  backgroundColor: "#fff",
  boxSizing: "border-box",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: T.textMuted,
  marginBottom: 4,
  display: "block",
  textTransform: "uppercase",
  letterSpacing: "0.3px",
};

function fieldFocus(e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = "#3b5229";
  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,139,75,0.12)";
}

function fieldBlur(e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = T.border;
  e.currentTarget.style.boxShadow = "none";
}

interface CenterLeadRow {
  id: string;
  centre_display_name: string;
  country: string | null;
  stage: CenterLeadStage;
  linked_crm_centre_label: string | null;
  lead_vendor_label: string | null;
  opportunity_source: string | null;
  expected_start_date: string | null;
  committed_daily_sales: number | null;
  committed_daily_transfers: number | null;
  closer_count: number | null;
  buyer_details: string | null;
  daily_sales_generation_notes: string | null;
  trending_metrics_notes: string | null;
  owner_manager_contact_notes: string | null;
  last_disposition_text: string | null;
  last_call_result: string | null;
  last_call_result_at: string | null;
  form_submitted_at: string | null;
  created_at: string;
  linked_call_center_id: string | null;
}

interface TeamMemberRow {
  id: string;
  member_kind: "center_admin" | "team_member";
  full_name: string;
  email: string;
  phone: string | null;
  position_key: string;
  custom_position_label: string | null;
  sort_order: number;
}

interface CredentialRow {
  id: string;
  slack_account_details: string | null;
  crm_access_details: string | null;
  did_number: string | null;
  other_notes: string | null;
  logged_at: string;
}

interface CallResultRow {
  id: string;
  result_code: string;
  notes: string | null;
  recorded_at: string;
  recorded_by: string | null;
}

interface NoteRow {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface ResourceRow {
  id: string;
  scope: string;
  title: string;
  description: string | null;
  content_kind: string;
  external_url: string | null;
  center_lead_id: string | null;
}

function TabNavigation({
  activeTab,
  onTabChange,
  tabs,
}: {
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  tabs: DetailTab[];
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-start",
        gap: 4,
        padding: 4,
        backgroundColor: T.sidebarBg,
        borderRadius: 10,
        flexWrap: "wrap",
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            style={{
              height: 32,
              padding: "0 12px",
              borderRadius: 8,
              border: "none",
              background: isActive ? BRAND_GREEN : "transparent",
              color: isActive ? "#fff" : T.textMuted,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: T.font,
              cursor: "pointer",
              boxShadow: isActive ? "0 2px 8px rgba(35, 50, 23, 0.2)" : "none",
              transition: "all 0.15s ease-in-out",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              whiteSpace: "nowrap",
            }}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}

export default function BpoCentreLeadViewComponent({
  centerLeadId,
  canEdit,
  onBack,
}: {
  centerLeadId?: string;
  canEdit: boolean;
  onBack: () => void;
  allLeadIds?: string[];
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const { currentUserId, currentRole } = useDashboardContext();

  const [activeTab, setActiveTab] = useState<DetailTab>("Overview");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [draft, setDraft] = useState<CenterLeadRow | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  const [team, setTeam] = useState<TeamMemberRow[]>([]);
  const [credentials, setCredentials] = useState<CredentialRow[]>([]);
  const [callResults, setCallResults] = useState<CallResultRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [resourcesUniversal, setResourcesUniversal] = useState<ResourceRow[]>([]);
  const [resourcesLead, setResourcesLead] = useState<ResourceRow[]>([]);
  const [centreUsers, setCentreUsers] = useState<{ id: string; name: string; roleKey: string | null }[]>([]);

  const [authorNameByUserId, setAuthorNameByUserId] = useState<Record<string, string>>({});
  const [activitySearchInput, setActivitySearchInput] = useState("");
  const [activitySearchQuery, setActivitySearchQuery] = useState("");
  const [activityPage, setActivityPage] = useState(1);
  const ACTIVITY_PAGE_SIZE = 5;

  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [credForm, setCredForm] = useState({ slack: "", crm: "", did: "", other: "" });
  const [callNotes, setCallNotes] = useState("");
  const [callDisposition, setCallDisposition] = useState<"" | "call_completed" | "no_pickup">("");
  const [resLeadForm, setResLeadForm] = useState({ title: "", url: "", description: "" });
  const [resGlobalForm, setResGlobalForm] = useState({ title: "", url: "", description: "" });

  const loadDetail = useCallback(async () => {
    if (!centerLeadId) {
      setErrorMessage("Centre lead not found.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    const [
      { data: lead, error: eLead },
      { data: inv },
      { data: tm },
      { data: cr },
      { data: calls },
      { data: nt },
      { data: ru },
      { data: rl },
    ] = await Promise.all([
      supabase.from("bpo_center_leads").select("*").eq("id", centerLeadId).maybeSingle(),
      supabase
        .from("bpo_center_lead_invites")
        .select("token")
        .eq("center_lead_id", centerLeadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("bpo_center_lead_team_members").select("*").eq("center_lead_id", centerLeadId).order("sort_order"),
      supabase
        .from("bpo_center_lead_credentials")
        .select("*")
        .eq("center_lead_id", centerLeadId)
        .order("logged_at", { ascending: false }),
      supabase
        .from("bpo_center_lead_call_results")
        .select("*")
        .eq("center_lead_id", centerLeadId)
        .order("recorded_at", { ascending: false }),
      supabase.from("bpo_center_lead_notes").select("*").eq("center_lead_id", centerLeadId).order("created_at", { ascending: false }),
      supabase.from("bpo_center_lead_resources").select("*").eq("scope", "universal").order("created_at", { ascending: false }),
      supabase
        .from("bpo_center_lead_resources")
        .select("*")
        .eq("scope", "lead")
        .eq("center_lead_id", centerLeadId)
        .order("created_at", { ascending: false }),
    ]);
    if (eLead) {
      setErrorMessage(eLead.message);
      setLoading(false);
      return;
    }
    const callRows = (calls ?? []) as CallResultRow[];
    const noteRows = (nt ?? []) as NoteRow[];
    const authorIds = [
      ...new Set(
        [...callRows.map((c) => c.recorded_by), ...noteRows.map((n) => n.created_by)].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ];
    let nameById: Record<string, string> = {};
    if (authorIds.length) {
      const { data: users } = await supabase.from("users").select("id, full_name, email").in("id", authorIds);
      if (users?.length) {
        nameById = Object.fromEntries(
          (users as { id: string; full_name: string | null; email: string | null }[]).map((u) => [
            u.id,
            u.full_name?.trim() || u.email?.trim() || "User",
          ]),
        );
      }
    }
    setAuthorNameByUserId(nameById);
    setDraft((lead ?? null) as CenterLeadRow | null);
    setInviteToken(inv?.token ? String(inv.token) : null);
    setTeam((tm ?? []) as TeamMemberRow[]);
    setCredentials((cr ?? []) as CredentialRow[]);
    setCallResults(callRows);
    setNotes(noteRows);
    setResourcesUniversal((ru ?? []) as ResourceRow[]);
    setResourcesLead((rl ?? []) as ResourceRow[]);

    const linkedCentreId = (lead as CenterLeadRow | null)?.linked_call_center_id ?? null;
    if (linkedCentreId) {
      const [{ data: centreUserRows }, { data: roleRows }] = await Promise.all([
        supabase.from("users").select("id, full_name, role_id").eq("call_center_id", linkedCentreId),
        supabase.from("roles").select("id, key"),
      ]);
      const roleKeyById: Record<string, string> = Object.fromEntries(
        ((roleRows ?? []) as { id: string; key: string }[]).map((r) => [r.id, r.key]),
      );
      setCentreUsers(
        ((centreUserRows ?? []) as { id: string; full_name: string | null; role_id: string | null }[]).map((u) => ({
          id: u.id,
          name: u.full_name?.trim() || `User ${u.id.slice(0, 8)}`,
          roleKey: u.role_id ? roleKeyById[u.role_id] ?? null : null,
        })),
      );
    } else {
      setCentreUsers([]);
    }
    setLoading(false);
  }, [centerLeadId, supabase]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadDetail();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadDetail]);

  useEffect(() => {
    setActivitySearchInput("");
    setActivitySearchQuery("");
    setActivityPage(1);
  }, [centerLeadId]);

  useEffect(() => {
    setActivityPage(1);
  }, [activitySearchQuery]);

  const publicOpenIntakeUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/onboarding`;
  }, []);

  const leadInviteUrl = useMemo(() => {
    if (!inviteToken || typeof window === "undefined") return "";
    return `${window.location.origin}/onboarding/${inviteToken}`;
  }, [inviteToken]);

  const isDqed = draft?.stage === "dqed" || draft?.stage === "offboarded";
  const isDisabled = !canEdit || isDqed;

  const saveCentreLead = useCallback(async () => {
    if (!centerLeadId || !draft) return;
    if (!canEdit) {
      setToast({ message: "You do not have permission to edit this centre lead.", type: "error" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("bpo_center_leads")
      .update({
        centre_display_name: draft.centre_display_name,
        country: draft.country?.trim() || null,
        stage: draft.stage,
        linked_crm_centre_label: draft.linked_crm_centre_label?.trim() || null,
        lead_vendor_label: draft.lead_vendor_label?.trim() || null,
        opportunity_source: draft.opportunity_source?.trim() || null,
        expected_start_date: draft.expected_start_date || null,
        committed_daily_sales: draft.committed_daily_sales,
        committed_daily_transfers: draft.committed_daily_transfers,
        closer_count: draft.closer_count,
        buyer_details: draft.buyer_details?.trim() || null,
        daily_sales_generation_notes: draft.daily_sales_generation_notes?.trim() || null,
        trending_metrics_notes: draft.trending_metrics_notes?.trim() || null,
        owner_manager_contact_notes: draft.owner_manager_contact_notes?.trim() || null,
        last_disposition_text: draft.last_disposition_text?.trim() || null,
        updated_by: currentUserId,
      })
      .eq("id", centerLeadId);
    setSaving(false);
    if (error) {
      setToast({ message: error.message, type: "error" });
      return;
    }
    setToast({ message: "Saved.", type: "success" });
    setIsEditing(false);
    await loadDetail();
  }, [canEdit, centerLeadId, currentUserId, draft, loadDetail, supabase]);

  const logCredential = useCallback(async () => {
    if (!centerLeadId) return;
    if (!canEdit) {
      setToast({ message: "You do not have permission to edit this centre lead.", type: "error" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("bpo_center_lead_credentials").insert({
      center_lead_id: centerLeadId,
      slack_account_details: credForm.slack.trim() || null,
      crm_access_details: credForm.crm.trim() || null,
      did_number: credForm.did.trim() || null,
      other_notes: credForm.other.trim() || null,
      logged_by: currentUserId,
    });
    setSaving(false);
    if (error) {
      setToast({ message: error.message, type: "error" });
      return;
    }
    setCredForm({ slack: "", crm: "", did: "", other: "" });
    setToast({ message: "Credential entry logged.", type: "success" });
    await loadDetail();
  }, [canEdit, centerLeadId, credForm, currentUserId, loadDetail, supabase]);

  const logCallUpdate = useCallback(async () => {
    if (!centerLeadId || !draft) return;
    if (!canEdit) {
      setToast({ message: "You do not have permission to edit this centre lead.", type: "error" });
      return;
    }
    if (!callDisposition) {
      setToast({ message: "Pick a disposition.", type: "error" });
      return;
    }
    setSaving(true);

    const dispositionLabel = callDisposition === "call_completed" ? "Call completed" : "No pickup";

    const { error: e1 } = await supabase.from("bpo_center_lead_call_results").insert({
      center_lead_id: centerLeadId,
      result_code: callDisposition,
      notes: callNotes.trim() || null,
      recorded_by: currentUserId,
    });
    if (e1) {
      setSaving(false);
      setToast({ message: e1.message, type: "error" });
      return;
    }

    const { error: e2 } = await supabase
      .from("bpo_center_leads")
      .update({ last_disposition_text: dispositionLabel, updated_by: currentUserId })
      .eq("id", centerLeadId);
    if (e2) {
      setSaving(false);
      setToast({ message: e2.message, type: "error" });
      return;
    }
    setDraft((d) => (d ? { ...d, last_disposition_text: dispositionLabel } : d));

    setSaving(false);
    setCallDisposition("");
    setCallNotes("");
    setToast({ message: "Call update logged.", type: "success" });
    await loadDetail();
  }, [callDisposition, callNotes, canEdit, centerLeadId, currentUserId, draft, loadDetail, supabase]);

  const activityFeed = useMemo(() => {
    const resolveActor = (userId: string | null | undefined) =>
      userId ? (authorNameByUserId[userId]?.trim() || "Unknown user") : "Unknown user";

    const calls =
      callResults?.map((c) => ({
        id: `call:${c.id}`,
        kind: "call" as const,
        at: new Date(c.recorded_at).getTime(),
        code: c.result_code,
        body: c.notes ?? "",
        actorLabel: resolveActor(c.recorded_by),
      })) ?? [];
    const noteItems =
      notes?.map((n) => ({
        id: `note:${n.id}`,
        kind: "note" as const,
        at: new Date(n.created_at).getTime(),
        code: "note",
        body: n.body ?? "",
        actorLabel: resolveActor(n.created_by),
      })) ?? [];
    return [...calls, ...noteItems].sort((a, b) => b.at - a.at);
  }, [authorNameByUserId, callResults, notes]);

  const filteredActivityFeed = useMemo(() => {
    const q = activitySearchQuery.trim().toLowerCase();
    if (!q) return activityFeed;
    return activityFeed.filter((item) => {
      const title = item.kind === "call" ? formatCallResultLabel(item.code) : "Note";
      const hay = [title, item.body, item.actorLabel, new Date(item.at).toLocaleString()]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [activityFeed, activitySearchQuery]);

  const activityTotalPages = Math.max(1, Math.ceil(filteredActivityFeed.length / ACTIVITY_PAGE_SIZE));
  const activityCurrentPage = Math.min(activityPage, activityTotalPages);
  const pagedActivityFeed = useMemo(() => {
    const start = (activityCurrentPage - 1) * ACTIVITY_PAGE_SIZE;
    return filteredActivityFeed.slice(start, start + ACTIVITY_PAGE_SIZE);
  }, [filteredActivityFeed, activityCurrentPage]);

  useEffect(() => {
    if (activityPage > activityTotalPages) setActivityPage(activityTotalPages);
  }, [activityPage, activityTotalPages]);

  const intakeAdmin = useMemo(() => team.find((m) => m.member_kind === "center_admin") ?? null, [team]);
  const intakeCloser = useMemo(() => team.find((m) => m.position_key === "closer") ?? null, [team]);

  const credentialsEmail = useMemo(() => {
    const centreName = draft?.centre_display_name?.trim() || "your centre";
    const adminName = intakeAdmin?.full_name || "Centre admin";
    const adminEmail = intakeAdmin?.email || "";
    const closerName = intakeCloser?.full_name || "Closer";
    const closerEmail = intakeCloser?.email || "";

    const lines: string[] = [];
    lines.push(`Hello ${adminName},`);
    lines.push("");
    lines.push(`Here are the access details for ${centreName}:`);
    lines.push("");
    if (adminEmail) lines.push(`Centre admin login: ${adminEmail}`);
    if (closerEmail) lines.push(`Closer login: ${closerEmail} (${closerName})`);
    if (credForm.slack.trim()) lines.push(`Slack: ${credForm.slack.trim()}`);
    if (credForm.crm.trim()) lines.push(`CRM access: ${credForm.crm.trim()}`);
    if (credForm.did.trim()) lines.push(`DID: ${credForm.did.trim()}`);
    if (credForm.other.trim()) lines.push(`Notes: ${credForm.other.trim()}`);
    lines.push("");
    lines.push(`To set your password, use “Forgot password” on the Insurvas sign-in screen with your login email.`);
    lines.push("");
    lines.push("Thanks,");
    lines.push("Insurvas");

    return {
      subject: `Insurvas access details – ${centreName}`,
      body: lines.join("\n"),
    };
  }, [credForm.crm, credForm.did, credForm.other, credForm.slack, draft?.centre_display_name, intakeAdmin?.email, intakeAdmin?.full_name, intakeCloser?.email, intakeCloser?.full_name]);

  const addResource = useCallback(
    async (scope: "universal" | "lead", form: { title: string; url: string; description: string }) => {
      if (!form.title.trim()) {
        setToast({ message: "Title is required.", type: "error" });
        return;
      }
      if (!canEdit) {
        setToast({ message: "You do not have permission to edit this centre lead.", type: "error" });
        return;
      }
      setSaving(true);
      const row =
        scope === "universal"
          ? {
              scope: "universal" as const,
              title: form.title.trim(),
              description: form.description.trim() || null,
              content_kind: "link",
              external_url: form.url.trim() || null,
              created_by: currentUserId,
            }
          : {
              scope: "lead" as const,
              center_lead_id: centerLeadId,
              title: form.title.trim(),
              description: form.description.trim() || null,
              content_kind: "link",
              external_url: form.url.trim() || null,
              created_by: currentUserId,
            };
      const { error } = await supabase.from("bpo_center_lead_resources").insert(row);
      setSaving(false);
      if (error) {
        setToast({ message: error.message, type: "error" });
        return;
      }
      if (scope === "universal") setResGlobalForm({ title: "", url: "", description: "" });
      else setResLeadForm({ title: "", url: "", description: "" });
      setToast({ message: "Resource added.", type: "success" });
      await loadDetail();
    },
    [canEdit, centerLeadId, currentUserId, loadDetail, supabase],
  );

  const deleteUniversalResource = useCallback(
    async (id: string) => {
      if (!canEdit) {
        setToast({ message: "You do not have permission to edit this centre lead.", type: "error" });
        return;
      }
      const { error } = await supabase.from("bpo_center_lead_resources").delete().eq("id", id);
      if (error) setToast({ message: error.message, type: "error" });
      else {
        setToast({ message: "Removed.", type: "success" });
        await loadDetail();
      }
    },
    [canEdit, loadDetail, supabase],
  );

  if (currentRole !== "system_admin") {
    return (
      <div className="mx-auto w-full max-w-[1200px]" style={{ fontFamily: T.font }}>
        <Card className="rounded-2xl border p-8" style={{ borderColor: T.border, background: T.cardBg }}>
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5" style={{ color: "#991b1b" }} />
            <div>
              <h2 className="m-0 text-lg font-extrabold" style={{ color: T.textDark }}>
                Restricted workspace
              </h2>
              <p className="m-0 mt-2 text-sm font-medium" style={{ color: T.textMuted }}>
                BPO Onboarding is currently available to System Admin users only.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] transition-all duration-150" style={{ fontFamily: T.font }}>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header bar: Back + Nav + Tabs + Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "#fff",
              border: `1.5px solid ${T.border}`,
              borderRadius: 10,
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: T.textMid,
              transition: "all 0.15s",
              flexShrink: 0,
            }}
            aria-label="Back"
          >
            <ChevronLeft size={18} />
          </button>

          <TabNavigation
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={["Overview", "Centre & Team setup", "Resources", "Credentials"]}
          />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            type="button"
            disabled={isDisabled || !draft}
            onClick={() => setIsEditing(true)}
            style={{
              height: 34,
              padding: "0 18px",
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: T.cardBg,
              color: BRAND_GREEN,
              fontSize: 12,
              fontWeight: 700,
              cursor: isDisabled || !draft ? "not-allowed" : "pointer",
              opacity: isDisabled || !draft ? 0.55 : 1,
              transition: "all 0.15s ease-in-out",
            }}
            onMouseEnter={(e) => {
              if (isDisabled || !draft) return;
              e.currentTarget.style.backgroundColor = BRAND_GREEN;
              e.currentTarget.style.color = "#fff";
              e.currentTarget.style.borderColor = BRAND_GREEN;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = T.cardBg;
              e.currentTarget.style.color = BRAND_GREEN;
              e.currentTarget.style.borderColor = T.border;
            }}
          >
            Edit Lead
          </button>

          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(leadInviteUrl || publicOpenIntakeUrl);
              setToast({ message: "Intake link copied.", type: "success" });
            }}
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: "#fff",
              color: BRAND_GREEN,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <ClipboardCopy size={13} />
            Copy link
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 70 }}>
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: BRAND_GREEN }} />
        </div>
      ) : errorMessage ? (
        <div style={{ padding: 22, color: "#991b1b", fontWeight: 700 }}>{errorMessage}</div>
      ) : !draft ? (
        <div style={{ padding: 22, color: T.textMuted, fontWeight: 700 }}>Centre lead not found.</div>
      ) : activeTab === "Overview" ? (
        /* ═══════════════════════════════════════════════════════════════════
           3-PANEL LAYOUT: Profile (top-left), Notes (bottom-left), Call (right)
           ═══════════════════════════════════════════════════════════════════ */
        <div style={{ display: "grid", gridTemplateColumns: "1fr 480px", gap: 18, alignItems: "start" }}>
          {/* LEFT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Section 1: Centre profile */}
            <LeadCard
              icon="🏢"
              title="Centre profile"
              subtitle="Identity, stage, and capacity"
              actions={
                draft.last_call_result ? (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: 6,
                      background: draft.last_call_result === "call_completed" ? "#dcfce7" : "#fef3c7",
                      color: draft.last_call_result === "call_completed" ? "#166534" : "#92400e",
                      border: `1px solid ${draft.last_call_result === "call_completed" ? "#86efac" : "#fcd34d"}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatCallResultLabel(draft.last_call_result)}
                    {draft.last_call_result_at && (
                      <> &mdash; {new Date(draft.last_call_result_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</>
                    )}
                  </span>
                ) : null
              }
            >
              <InfoGrid columns={3}>
                <InfoField label="Centre name" value={draft.centre_display_name} />
                <InfoField label="Stage" value={STAGE_LABEL[draft.stage] ?? draft.stage} />
                <InfoField label="Closers" value={draft.closer_count ?? "—"} />
              </InfoGrid>
              <InfoGrid columns={1} bordered={false}>
                <InfoField label="Country" value={draft.country?.trim() || "—"} />
              </InfoGrid>
              <InfoGrid columns={3} bordered={false}>
                <InfoField label="Daily sales target" value={draft.committed_daily_sales ?? "—"} />
                <InfoField label="Daily transfers target" value={draft.committed_daily_transfers ?? "—"} />
                <InfoField label="Expected start" value={formatDate(draft.expected_start_date ?? undefined)} />
              </InfoGrid>
            </LeadCard>

            {/* Section: Team roster */}
            <LeadCard
              icon="👥"
              title="Team"
              subtitle="Centre admin & onboarding team roster"
            >
              {team.length === 0 ? (
                <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>
                  No team members yet — send the intake link or add them from the Centre & Team setup tab.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {team.map((m) => {
                    const isAdmin = m.member_kind === "center_admin";
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "80px 1fr 1.4fr 0.9fr",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: `1px solid ${T.borderLight}`,
                          background: "#f8faf6",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 10,
                            fontWeight: 900,
                            textTransform: "uppercase",
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: isAdmin ? "#dcfce7" : "#eef2ff",
                            border: `1px solid ${isAdmin ? "#86efac" : "#c7d2fe"}`,
                            color: isAdmin ? "#166534" : "#3730a3",
                            letterSpacing: "0.02em",
                            width: "fit-content",
                          }}
                        >
                          {isAdmin ? "Admin" : "Member"}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: T.textDark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.full_name}
                        </span>
                        <span style={{ fontSize: 12, color: T.textMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.email}
                        </span>
                        <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600, textTransform: "capitalize", textAlign: "right" }}>
                          {m.position_key === "custom" ? m.custom_position_label || "—" : m.position_key}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </LeadCard>

            {/* Section 2: Notes & Disposition */}
            <LeadCard
              icon="📝"
              title="Notes & Disposition"
              subtitle="Latest disposition and centre notes"
            >
              {/* Last disposition */}
              <div style={{ marginBottom: 14 }}>
                <p style={{ ...labelStyle, marginBottom: 6 }}>Last disposition</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.textDark, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  {draft.last_disposition_text || "—"}
                </p>
              </div>

              {/* Activity feed: notes + call updates */}
              <p style={{ ...labelStyle, marginBottom: 6 }}>Activity</p>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "stretch",
                  marginBottom: 10,
                  flexWrap: "wrap",
                }}
              >
                <input
                  type="search"
                  placeholder="Search conversation…"
                  value={activitySearchInput}
                  onChange={(e) => setActivitySearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setActivitySearchQuery(activitySearchInput.trim().toLowerCase());
                    }
                  }}
                  style={{ ...fieldStyle, flex: "1 1 160px", minWidth: 0, fontSize: 13 }}
                  onFocus={fieldFocus}
                  onBlur={fieldBlur}
                />
                <button
                  type="button"
                  onClick={() => setActivitySearchQuery(activitySearchInput.trim().toLowerCase())}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    borderRadius: 10,
                    border: `1px solid ${BRAND_GREEN}`,
                    background: BRAND_GREEN,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 800,
                    padding: "0 14px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Search size={14} strokeWidth={2.5} />
                  Search
                </button>
                {activitySearchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActivitySearchInput("");
                      setActivitySearchQuery("");
                    }}
                    style={{
                      borderRadius: 10,
                      border: `1px solid ${T.border}`,
                      background: T.cardBg,
                      color: T.textMuted,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "0 12px",
                      cursor: "pointer",
                    }}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {activityFeed.length === 0 ? (
                  <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>No activity logged yet.</div>
                ) : filteredActivityFeed.length === 0 ? (
                  <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>No results match your search.</div>
                ) : (
                  pagedActivityFeed.map((item) => {
                    const isCall = item.kind === "call";
                    const title = isCall ? formatCallResultLabel(item.code) : "Note";
                    const chipBg = isCall ? "#dcfce7" : "#eef2ff";
                    const chipBorder = isCall ? "#86efac" : "#c7d2fe";
                    const chipText = isCall ? "#166534" : "#3730a3";
                    const byLine = isCall ? `Call logged by ${item.actorLabel}` : `Note added by ${item.actorLabel}`;
                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: `1px solid ${T.borderLight}`,
                          background: "#f8faf6",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 900,
                                textTransform: "uppercase",
                                padding: "3px 8px",
                                borderRadius: 999,
                                background: chipBg,
                                border: `1px solid ${chipBorder}`,
                                color: chipText,
                                letterSpacing: "0.02em",
                              }}
                            >
                              {isCall ? "Call" : "Note"}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: T.textDark, textTransform: "uppercase" }}>
                              {title}
                            </span>
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted }}>
                            {new Date(item.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, marginBottom: item.body ? 6 : 0 }}>
                          {byLine}
                        </div>
                        {item.body && (
                          <div style={{ fontSize: 12, color: T.textDark, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                            {item.body}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              {filteredActivityFeed.length > ACTIVITY_PAGE_SIZE && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 4px 0",
                    marginTop: 8,
                    borderTop: `1px solid ${T.borderLight}`,
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted }}>
                    Showing {(activityCurrentPage - 1) * ACTIVITY_PAGE_SIZE + 1}
                    –{Math.min(activityCurrentPage * ACTIVITY_PAGE_SIZE, filteredActivityFeed.length)} of {filteredActivityFeed.length}
                  </span>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                      disabled={activityCurrentPage === 1}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 6,
                        border: `1px solid ${T.border}`,
                        background: "#fff",
                        color: activityCurrentPage === 1 ? T.textMuted : BRAND_GREEN,
                        cursor: activityCurrentPage === 1 ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: activityCurrentPage === 1 ? 0.5 : 1,
                      }}
                      aria-label="Previous page"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                    </button>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>
                      {activityCurrentPage} / {activityTotalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActivityPage((p) => Math.min(activityTotalPages, p + 1))}
                      disabled={activityCurrentPage === activityTotalPages}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 6,
                        border: `1px solid ${T.border}`,
                        background: "#fff",
                        color: activityCurrentPage === activityTotalPages ? T.textMuted : BRAND_GREEN,
                        cursor: activityCurrentPage === activityTotalPages ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: activityCurrentPage === activityTotalPages ? 0.5 : 1,
                      }}
                      aria-label="Next page"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </LeadCard>

          </div>

          {/* RIGHT COLUMN: Call Result Update Panel */}
          <div style={{ position: "sticky", top: 20 }}>
          <LeadCard
            icon="📞"
            title="Call update"
            subtitle="Log dispositions and outcomes"
            collapsible={false}
          >
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Disposition</label>
              <StyledSelect
                value={callDisposition}
                disabled={isDisabled}
                onValueChange={(v) => setCallDisposition((v as "call_completed" | "no_pickup" | "") || "")}
                options={[
                  { value: "call_completed", label: "Call completed" },
                  { value: "no_pickup", label: "No pickup" },
                ]}
                placeholder="Pick a disposition"
              />
            </div>

            <label style={labelStyle}>Notes</label>
            <textarea
              value={callNotes}
              disabled={isDisabled}
              onChange={(e) => setCallNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={3}
              style={{ ...fieldStyle, marginBottom: 12, resize: "vertical", minHeight: 70, opacity: isDisabled ? 0.65 : 1 }}
              onFocus={fieldFocus}
              onBlur={fieldBlur}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
              <button
                type="button"
                disabled={isDisabled || saving || !callDisposition}
                onClick={() => void logCallUpdate()}
                style={{
                  height: 32,
                  padding: "0 16px",
                  borderRadius: 8,
                  border: "none",
                  background: BRAND_GREEN,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: isDisabled || saving || !callDisposition ? "not-allowed" : "pointer",
                  opacity: isDisabled || saving || !callDisposition ? 0.6 : 1,
                  fontFamily: T.font,
                  letterSpacing: "0.02em",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {saving ? "Submitting..." : "Submit"}
              </button>
            </div>
          </LeadCard>
          </div>
        </div>
      ) : activeTab === "Centre & Team setup" ? (
        /* ═══════════════ CENTRE & TEAM SETUP TAB ═══════════════ */
        <div style={{ width: "100%" }}>
          <LeadCard
            icon="🏢"
            title={draft.centre_display_name?.trim() || "Centre"}
            subtitle="Centre onboarding"
            collapsible={false}
          >
            {isDqed ? (
              <div style={{ fontSize: 13, color: T.textMuted, fontWeight: 600 }}>
                This centre lead is DQED — centre onboarding is disabled.
              </div>
            ) : (
              <BpoCentreLeadOnboardingForm
                linkedCenterId={draft.linked_call_center_id}
                teamMembers={centreUsers}
                onRemoveTeamMember={async (userId) => {
                  const { error } = await supabase
                    .from("users")
                    .update({ call_center_id: null })
                    .eq("id", userId);
                  if (error) {
                    setToast({ message: `Failed to remove team member: ${error.message}`, type: "error" });
                    return;
                  }
                  setToast({ message: "Team member removed from centre.", type: "success" });
                  await loadDetail();
                }}
                prefill={{
                  centreName: draft.centre_display_name,
                  country: draft.country,
                  did: credentials[0]?.did_number ?? null,
                  slackChannel: credentials[0]?.slack_account_details ?? null,
                  email: intakeAdmin?.email ?? null,
                  dailyTransferTarget: draft.committed_daily_transfers ?? null,
                  dailySalesTarget: draft.committed_daily_sales ?? null,
                  adminFullName: intakeAdmin?.full_name ?? null,
                  adminEmail: intakeAdmin?.email ?? null,
                  adminPhone: intakeAdmin?.phone ?? null,
                }}
                onCancel={onBack}
                onCreateCentre={async (values) => {
                  if (!canEdit) {
                    setToast({ message: "You do not have permission to edit this centre lead.", type: "error" });
                    return null;
                  }
                  const { data, error } = await supabase
                    .from("call_centers")
                    .insert([{
                      name: values.centreName,
                      did: values.did || null,
                      slack_channel: values.slackChannel || null,
                      email: values.email || null,
                      region: bpoRegionForCountry(values.country)?.trim() || null,
                      country: values.country || null,
                    }])
                    .select("id")
                    .single();
                  if (error || !data?.id) {
                    setToast({ message: `Failed to create centre: ${error?.message || "Unknown error"}`, type: "error" });
                    return null;
                  }
                  const { error: linkError } = await supabase
                    .from("bpo_center_leads")
                    .update({
                      linked_call_center_id: data.id,
                      linked_crm_centre_label: values.centreName,
                      updated_by: currentUserId,
                    })
                    .eq("id", centerLeadId);
                  if (linkError) {
                    setToast({ message: `Centre created but failed to link to lead: ${linkError.message}`, type: "error" });
                  } else {
                    setToast({ message: "Centre created successfully.", type: "success" });
                  }
                  await loadDetail();
                  return { id: data.id };
                }}
                onSaveThresholds={() => setToast({ message: "Threshold settings save will be wired up soon.", type: "success" })}
                onTeamSetupSubmit={async () => {
                  setToast({ message: "Team member created and assigned to centre.", type: "success" });
                  await loadDetail();
                }}
              />
            )}
          </LeadCard>
        </div>
      ) : activeTab === "Resources" ? (
        /* ═══════════════ RESOURCES TAB ═══════════════ */
        <div style={{ maxWidth: 1200, display: "flex", flexDirection: "column", gap: 16 }}>
          <LeadCard icon="📚" title="Universal library" subtitle="Resources available to all centres" defaultExpanded={true}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, marginBottom: 10 }}>
              <input placeholder="Title" value={resGlobalForm.title} onChange={(e) => setResGlobalForm((f) => ({ ...f, title: e.target.value }))} style={{ ...fieldStyle, fontWeight: 500 }} onFocus={fieldFocus} onBlur={fieldBlur} />
              <input placeholder="URL" value={resGlobalForm.url} onChange={(e) => setResGlobalForm((f) => ({ ...f, url: e.target.value }))} style={{ ...fieldStyle, fontWeight: 500 }} onFocus={fieldFocus} onBlur={fieldBlur} />
              <textarea placeholder="Description" value={resGlobalForm.description} onChange={(e) => setResGlobalForm((f) => ({ ...f, description: e.target.value }))} rows={2} style={{ ...fieldStyle, fontWeight: 500, resize: "vertical", gridColumn: "1 / -1" }} onFocus={fieldFocus} onBlur={fieldBlur} />
            </div>
            <button
              type="button"
              disabled={!canEdit || saving}
              onClick={() => void addResource("universal", resGlobalForm)}
              style={{ height: 32, padding: "0 12px", borderRadius: 8, border: "none", background: T.blueHover, color: "#fff", fontSize: 11, fontWeight: 900, cursor: !canEdit || saving ? "not-allowed" : "pointer", opacity: !canEdit || saving ? 0.6 : 1, marginBottom: 12 }}
            >
              Add universal resource
            </button>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {resourcesUniversal.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderRadius: 10, border: `1px solid ${T.border}`, padding: "8px 12px", fontSize: 12 }}>
                  <span style={{ fontWeight: 800, color: T.textDark }}>{r.title}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {r.external_url && <a href={r.external_url} style={{ fontWeight: 800, color: BRAND_GREEN, textDecoration: "underline", fontSize: 11 }} target="_blank" rel="noreferrer">Open</a>}
                    <button type="button" onClick={() => void deleteUniversalResource(r.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#b91c1c", padding: 2 }}><Trash2 size={13} /></button>
                  </span>
                </div>
              ))}
            </div>
          </LeadCard>

          <LeadCard icon="🔗" title="This centre" subtitle="Lead-specific resources" defaultExpanded={true}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, marginBottom: 10 }}>
              <input placeholder="Title" value={resLeadForm.title} onChange={(e) => setResLeadForm((f) => ({ ...f, title: e.target.value }))} style={{ ...fieldStyle, fontWeight: 500 }} onFocus={fieldFocus} onBlur={fieldBlur} />
              <input placeholder="URL" value={resLeadForm.url} onChange={(e) => setResLeadForm((f) => ({ ...f, url: e.target.value }))} style={{ ...fieldStyle, fontWeight: 500 }} onFocus={fieldFocus} onBlur={fieldBlur} />
              <textarea placeholder="Description" value={resLeadForm.description} onChange={(e) => setResLeadForm((f) => ({ ...f, description: e.target.value }))} rows={2} style={{ ...fieldStyle, fontWeight: 500, resize: "vertical", gridColumn: "1 / -1" }} onFocus={fieldFocus} onBlur={fieldBlur} />
            </div>
            <button
              type="button"
              disabled={isDisabled || saving}
              onClick={() => void addResource("lead", resLeadForm)}
              style={{ height: 32, padding: "0 12px", borderRadius: 8, border: "none", background: BRAND_GREEN, color: "#fff", fontSize: 11, fontWeight: 900, cursor: isDisabled || saving ? "not-allowed" : "pointer", opacity: isDisabled || saving ? 0.6 : 1 }}
            >
              Add resource
            </button>
            {resourcesLead.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {resourcesLead.map((r) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 10, border: `1px solid ${T.border}`, padding: "8px 12px", fontSize: 12 }}>
                    <span style={{ fontWeight: 800, color: T.textDark }}>{r.title}</span>
                    {r.external_url && <a href={r.external_url} style={{ fontWeight: 800, color: BRAND_GREEN, textDecoration: "underline", fontSize: 11 }} target="_blank" rel="noreferrer">Open</a>}
                  </div>
                ))}
              </div>
            )}
          </LeadCard>
        </div>
      ) : activeTab === "Credentials" ? (
        /* ═══════════════ CREDENTIALS TAB ═══════════════ */
        <div style={{ maxWidth: 1200 }}>
          {!isDqed && (
            <div style={{ marginBottom: 16 }}>
              <LeadCard icon="👤" title="Provision users" subtitle="Create centre admin + closer accounts and send credentials" collapsible={false}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: BRAND_GREEN, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                      Suggested from intake
                    </div>
                    <div style={{ fontSize: 12, color: T.textMid, fontWeight: 600 }}>
                      Admin: {intakeAdmin ? `${intakeAdmin.full_name} (${intakeAdmin.email})` : "Not set"} · Closer: {intakeCloser ? `${intakeCloser.full_name} (${intakeCloser.email})` : "Not set"}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", paddingTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(`Subject: ${credentialsEmail.subject}\n\n${credentialsEmail.body}`);
                        setToast({ message: "Credentials email copied.", type: "success" });
                      }}
                      style={{
                        height: 34,
                        padding: "0 12px",
                        borderRadius: 10,
                        border: "none",
                        background: BRAND_GREEN,
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Copy credentials email
                    </button>
                    <a
                      href={`mailto:${encodeURIComponent(intakeAdmin?.email || "")}?subject=${encodeURIComponent(credentialsEmail.subject)}&body=${encodeURIComponent(credentialsEmail.body)}`}
                      style={{
                        height: 34,
                        padding: "0 12px",
                        borderRadius: 10,
                        border: `1px solid ${T.border}`,
                        background: "#fff",
                        color: BRAND_GREEN,
                        fontSize: 12,
                        fontWeight: 900,
                        display: "inline-flex",
                        alignItems: "center",
                        textDecoration: "none",
                      }}
                    >
                      Open email draft
                    </a>
                  </div>
                </div>
              </LeadCard>
            </div>
          )}

          <LeadCard icon="🔐" title="Credentials log" subtitle="Track access and DID provisioning" collapsible={false}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8, marginBottom: 8 }}>
              <input placeholder="Slack" value={credForm.slack} disabled={isDisabled} onChange={(e) => setCredForm((f) => ({ ...f, slack: e.target.value }))} style={{ ...fieldStyle, opacity: isDisabled ? 0.65 : 1, fontWeight: 500 }} onFocus={fieldFocus} onBlur={fieldBlur} />
              <input placeholder="CRM access" value={credForm.crm} disabled={isDisabled} onChange={(e) => setCredForm((f) => ({ ...f, crm: e.target.value }))} style={{ ...fieldStyle, opacity: isDisabled ? 0.65 : 1, fontWeight: 500 }} onFocus={fieldFocus} onBlur={fieldBlur} />
              <input placeholder="DID" value={credForm.did} disabled={isDisabled} onChange={(e) => setCredForm((f) => ({ ...f, did: e.target.value }))} style={{ ...fieldStyle, opacity: isDisabled ? 0.65 : 1, fontWeight: 500 }} onFocus={fieldFocus} onBlur={fieldBlur} />
            </div>
            <textarea placeholder="Other notes" value={credForm.other} disabled={isDisabled} onChange={(e) => setCredForm((f) => ({ ...f, other: e.target.value }))} rows={2} style={{ ...fieldStyle, marginBottom: 10, fontWeight: 500, opacity: isDisabled ? 0.65 : 1, resize: "vertical" }} onFocus={fieldFocus} onBlur={fieldBlur} />
            <button
              type="button"
              disabled={isDisabled || saving}
              onClick={() => void logCredential()}
              style={{ height: 32, padding: "0 12px", borderRadius: 8, border: "none", background: T.blueHover, color: "#fff", fontSize: 11, fontWeight: 900, cursor: isDisabled || saving ? "not-allowed" : "pointer", opacity: isDisabled || saving ? 0.6 : 1 }}
            >
              Log credential entry
            </button>
            {credentials.length > 0 && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {credentials.map((c) => (
                  <div key={c.id} style={{ borderRadius: 10, border: `1px solid ${T.border}`, backgroundColor: "#fafafa", padding: "10px 12px", fontSize: 12, color: T.textDark }}>
                    <div style={{ fontWeight: 900, marginBottom: 4 }}>{new Date(c.logged_at).toLocaleString()}</div>
                    {c.slack_account_details && <div>Slack: {c.slack_account_details}</div>}
                    {c.crm_access_details && <div>CRM: {c.crm_access_details}</div>}
                    {c.did_number && <div>DID: {c.did_number}</div>}
                    {c.other_notes && <div style={{ marginTop: 4, color: T.textMid }}>{c.other_notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </LeadCard>
        </div>
      ) : null}

      {!canEdit && (
        <div style={{ marginTop: 12, fontSize: 12, color: T.textMuted, fontWeight: 700 }}>
          Read-only view.
        </div>
      )}

      {/* ═══════════════ EDIT LEAD MODAL ═══════════════ */}
      {isEditing && draft && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 40,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              width: "100%",
              maxWidth: 880,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 28px",
                borderBottom: `1px solid ${T.borderLight}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    margin: "0 0 4px",
                    color: T.textDark,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  Edit &ldquo;{draft.centre_display_name || "Centre lead"}&rdquo;
                </h2>
                <p style={{ margin: 0, fontSize: 12, color: T.textMuted, fontWeight: 600 }}>
                  {canEdit
                    ? "Update centre profile and onboarding details."
                    : "Read-only view — you do not have permission to edit."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  void loadDetail();
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: T.textMuted,
                  padding: 8,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = T.pageBg;
                  e.currentTarget.style.color = T.textDark;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = T.textMuted;
                }}
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, padding: "20px 28px", overflowY: "auto", backgroundColor: "#fff" }}>
              {/* Centre profile */}
              <h3
                style={{
                  margin: "0 0 16px",
                  fontSize: 13,
                  fontWeight: 800,
                  color: T.textDark,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  borderBottom: `2px solid ${T.borderLight}`,
                  paddingBottom: 8,
                }}
              >
                Centre profile
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                <div>
                  <label style={labelStyle}>Centre name</label>
                  <input
                    value={draft.centre_display_name}
                    disabled={isDisabled}
                    onChange={(e) => setDraft({ ...draft, centre_display_name: e.target.value })}
                    style={{ ...fieldStyle, opacity: isDisabled ? 0.65 : 1 }}
                    onFocus={fieldFocus}
                    onBlur={fieldBlur}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Country</label>
                  <input
                    value={draft.country ?? ""}
                    disabled={isDisabled}
                    autoComplete="off"
                    placeholder="e.g. United Kingdom"
                    onChange={(e) => setDraft({ ...draft, country: e.target.value })}
                    style={{ ...fieldStyle, opacity: isDisabled ? 0.65 : 1 }}
                    onFocus={fieldFocus}
                    onBlur={fieldBlur}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Stage</label>
                  <StyledSelect
                    value={draft.stage}
                    disabled={isDisabled}
                    onValueChange={(v) => {
                      if (v) setDraft({ ...draft, stage: v as CenterLeadStage });
                    }}
                    options={STAGE_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
                    placeholder="Select stage"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Closers</label>
                  <input
                    type="number"
                    value={draft.closer_count ?? ""}
                    disabled={isDisabled}
                    onChange={(e) => setDraft({ ...draft, closer_count: e.target.value === "" ? null : Number(e.target.value) })}
                    style={{ ...fieldStyle, opacity: isDisabled ? 0.65 : 1 }}
                    onFocus={fieldFocus}
                    onBlur={fieldBlur}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Expected start</label>
                  <input
                    type="date"
                    value={draft.expected_start_date ?? ""}
                    disabled={isDisabled}
                    onChange={(e) => setDraft({ ...draft, expected_start_date: e.target.value || null })}
                    style={{ ...fieldStyle, opacity: isDisabled ? 0.65 : 1 }}
                    onFocus={fieldFocus}
                    onBlur={fieldBlur}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Daily sales target</label>
                  <input
                    type="number"
                    value={draft.committed_daily_sales ?? ""}
                    disabled={isDisabled}
                    onChange={(e) => setDraft({ ...draft, committed_daily_sales: e.target.value === "" ? null : Number(e.target.value) })}
                    style={{ ...fieldStyle, opacity: isDisabled ? 0.65 : 1 }}
                    onFocus={fieldFocus}
                    onBlur={fieldBlur}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Daily transfers target</label>
                  <input
                    type="number"
                    value={draft.committed_daily_transfers ?? ""}
                    disabled={isDisabled}
                    onChange={(e) => setDraft({ ...draft, committed_daily_transfers: e.target.value === "" ? null : Number(e.target.value) })}
                    style={{ ...fieldStyle, opacity: isDisabled ? 0.65 : 1 }}
                    onFocus={fieldFocus}
                    onBlur={fieldBlur}
                  />
                </div>
              </div>

              {/* Disposition */}
              <h3
                style={{
                  margin: "0 0 16px",
                  fontSize: 13,
                  fontWeight: 800,
                  color: T.textDark,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  borderBottom: `2px solid ${T.borderLight}`,
                  paddingBottom: 8,
                }}
              >
                Disposition
              </h3>
              <div>
                <label style={labelStyle}>Last disposition</label>
                <textarea
                  value={draft.last_disposition_text ?? ""}
                  disabled={isDisabled}
                  onChange={(e) => setDraft({ ...draft, last_disposition_text: e.target.value })}
                  rows={3}
                  style={{ ...fieldStyle, resize: "vertical", minHeight: 80, opacity: isDisabled ? 0.65 : 1 }}
                  onFocus={fieldFocus}
                  onBlur={fieldBlur}
                />
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "16px 28px",
                borderTop: `1px solid ${T.borderLight}`,
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                backgroundColor: "#fafcf8",
              }}
            >
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setIsEditing(false);
                  void loadDetail();
                }}
                style={{
                  height: 36,
                  padding: "0 18px",
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  background: "#fff",
                  color: T.textDark,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.6 : 1,
                  transition: "all 0.15s ease-in-out",
                  fontFamily: T.font,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDisabled || saving}
                onClick={() => void saveCentreLead()}
                style={{
                  height: 36,
                  padding: "0 22px",
                  borderRadius: 8,
                  border: "none",
                  background: BRAND_GREEN,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: isDisabled || saving ? "not-allowed" : "pointer",
                  opacity: isDisabled || saving ? 0.6 : 1,
                  transition: "all 0.15s ease-in-out",
                  fontFamily: T.font,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
