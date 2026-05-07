"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FocusEvent } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import {
  Table as ShadcnTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ClipboardCopy, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";
import { LeadCard } from "@/components/dashboard/pages/LeadCard";
import UserEditorComponent from "@/components/dashboard/pages/UserEditorComponent";

const BRAND_GREEN = "#233217";

function StyledSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={(val) => onValueChange(val || "")}>
      <SelectTrigger
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

type DetailTab = "Overview" | "Team" | "Resources" | "Credentials";

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

const STAGE_COLOR: Record<string, string> = {
  pre_onboarding: "#638b4b",
  ready_for_onboarding_meeting: "#2563eb",
  onboarding_completed: "#7c3aed",
  actively_selling: "#0f766e",
  needs_attention: "#d97706",
  on_pause: "#64748b",
  dqed: "#991b1b",
  offboarded: "#374151",
};

function getExpectedDqedCode(): string {
  return (
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BPO_ONBOARDING_DQED_CODE) || "DQED-CONFIRM"
  );
}

function formatCallResultLabel(key: string | null): string {
  if (!key) return "";
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());
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
  stage: CenterLeadStage;
  linked_crm_centre_label: string | null;
  lead_vendor_label: string | null;
  opportunity_value: number | null;
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
}

interface NoteRow {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
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
  allLeadIds,
}: {
  centerLeadId?: string;
  canEdit: boolean;
  onBack: () => void;
  allLeadIds?: string[];
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
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

  const [saving, setSaving] = useState(false);
  const [credForm, setCredForm] = useState({ slack: "", crm: "", did: "", other: "" });
  const [provisioned, setProvisioned] = useState<{ adminEmail?: string; adminName?: string; closerEmail?: string; closerName?: string }>({});
  const [showAdminProvision, setShowAdminProvision] = useState(false);
  const [showCloserProvision, setShowCloserProvision] = useState(false);
  const [callNotes, setCallNotes] = useState("");
  const [callDisposition, setCallDisposition] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [resLeadForm, setResLeadForm] = useState({ title: "", url: "", description: "" });
  const [resGlobalForm, setResGlobalForm] = useState({ title: "", url: "", description: "" });

  const [dqedPhrase, setDqedPhrase] = useState("");
  const [dqedCode, setDqedCode] = useState("");

  const [addMemberForm, setAddMemberForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    position_key: "closer" as "owner" | "manager" | "closer" | "custom",
    custom_position_label: "",
    member_kind: "team_member" as "center_admin" | "team_member",
  });

  // Next/prev navigation
  const currentIdx = allLeadIds?.indexOf(centerLeadId ?? "") ?? -1;
  const prevLeadId = currentIdx > 0 ? allLeadIds?.[currentIdx - 1] : null;
  const nextLeadId = allLeadIds && currentIdx < allLeadIds.length - 1 ? allLeadIds[currentIdx + 1] : null;

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
    setDraft((lead ?? null) as CenterLeadRow | null);
    setInviteToken(inv?.token ? String(inv.token) : null);
    setTeam((tm ?? []) as TeamMemberRow[]);
    setCredentials((cr ?? []) as CredentialRow[]);
    setCallResults((calls ?? []) as CallResultRow[]);
    setNotes((nt ?? []) as NoteRow[]);
    setResourcesUniversal((ru ?? []) as ResourceRow[]);
    setResourcesLead((rl ?? []) as ResourceRow[]);
    setLoading(false);
  }, [centerLeadId, supabase]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadDetail();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadDetail]);

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
        stage: draft.stage,
        linked_crm_centre_label: draft.linked_crm_centre_label?.trim() || null,
        lead_vendor_label: draft.lead_vendor_label?.trim() || null,
        opportunity_value: draft.opportunity_value,
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

  const addCallResult = useCallback(
    async (code: "call_completed" | "no_pickup") => {
      if (!centerLeadId) return;
      if (!canEdit) {
        setToast({ message: "You do not have permission to edit this centre lead.", type: "error" });
        return;
      }
      setSaving(true);
      const { error } = await supabase.from("bpo_center_lead_call_results").insert({
        center_lead_id: centerLeadId,
        result_code: code,
        notes: callNotes.trim() || null,
        recorded_by: currentUserId,
      });
      setSaving(false);
      if (error) {
        setToast({ message: error.message, type: "error" });
        return;
      }
      setCallNotes("");
      setToast({ message: "Call result recorded.", type: "success" });
      await loadDetail();
    },
    [callNotes, canEdit, centerLeadId, currentUserId, loadDetail, supabase],
  );

  const logCallUpdate = useCallback(async () => {
    if (!centerLeadId || !draft) return;
    if (!canEdit) {
      setToast({ message: "You do not have permission to edit this centre lead.", type: "error" });
      return;
    }
    if (!callDisposition.trim() && !callNotes.trim()) {
      setToast({ message: "Add a disposition or notes.", type: "error" });
      return;
    }
    setSaving(true);

    const updateNotes = [
      callDisposition.trim() ? `Disposition: ${callDisposition.trim()}` : null,
      callNotes.trim() ? `Notes: ${callNotes.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const { error: e1 } = await supabase.from("bpo_center_lead_call_results").insert({
      center_lead_id: centerLeadId,
      result_code: "call_update",
      notes: updateNotes || null,
      recorded_by: currentUserId,
    });
    if (e1) {
      setSaving(false);
      setToast({ message: e1.message, type: "error" });
      return;
    }

    if (callDisposition.trim()) {
      const { error: e2 } = await supabase
        .from("bpo_center_leads")
        .update({ last_disposition_text: callDisposition.trim(), updated_by: currentUserId })
        .eq("id", centerLeadId);
      if (e2) {
        setSaving(false);
        setToast({ message: e2.message, type: "error" });
        return;
      }
      setDraft((d) => (d ? { ...d, last_disposition_text: callDisposition.trim() } : d));
    }

    setSaving(false);
    setCallDisposition("");
    setCallNotes("");
    setToast({ message: "Call update logged.", type: "success" });
    await loadDetail();
  }, [callDisposition, callNotes, canEdit, centerLeadId, currentUserId, draft, loadDetail, supabase]);

  const addNote = useCallback(async () => {
    if (!centerLeadId || !noteDraft.trim()) return;
    if (!canEdit) {
      setToast({ message: "You do not have permission to edit this centre lead.", type: "error" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("bpo_center_lead_notes").insert({
      center_lead_id: centerLeadId,
      body: noteDraft.trim(),
      created_by: currentUserId,
    });
    setSaving(false);
    if (error) {
      setToast({ message: error.message, type: "error" });
      return;
    }
    setNoteDraft("");
    setToast({ message: "Note added.", type: "success" });
    await loadDetail();
  }, [canEdit, centerLeadId, currentUserId, loadDetail, noteDraft, supabase]);

  const activityFeed = useMemo(() => {
    const calls =
      callResults?.map((c) => ({
        id: `call:${c.id}`,
        kind: "call" as const,
        at: new Date(c.recorded_at).getTime(),
        code: c.result_code,
        body: c.notes ?? "",
      })) ?? [];
    const noteItems =
      notes?.map((n) => ({
        id: `note:${n.id}`,
        kind: "note" as const,
        at: new Date(n.created_at).getTime(),
        code: "note",
        body: n.body ?? "",
      })) ?? [];
    return [...calls, ...noteItems].sort((a, b) => b.at - a.at);
  }, [callResults, notes]);

  const intakeAdmin = useMemo(() => team.find((m) => m.member_kind === "center_admin") ?? null, [team]);
  const intakeCloser = useMemo(() => team.find((m) => m.position_key === "closer") ?? null, [team]);

  const credentialsEmail = useMemo(() => {
    const centreName = draft?.centre_display_name?.trim() || "your centre";
    const adminName = provisioned.adminName || intakeAdmin?.full_name || "Centre admin";
    const adminEmail = provisioned.adminEmail || intakeAdmin?.email || "";
    const closerName = provisioned.closerName || intakeCloser?.full_name || "Closer";
    const closerEmail = provisioned.closerEmail || intakeCloser?.email || "";

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
  }, [credForm.crm, credForm.did, credForm.other, credForm.slack, draft?.centre_display_name, intakeAdmin?.email, intakeAdmin?.full_name, intakeCloser?.email, intakeCloser?.full_name, provisioned.adminEmail, provisioned.adminName, provisioned.closerEmail, provisioned.closerName]);

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

  const addTeamMember = useCallback(async () => {
    if (!centerLeadId) return;
    if (!canEdit) {
      setToast({ message: "You do not have permission to edit this centre lead.", type: "error" });
      return;
    }
    if (!addMemberForm.full_name.trim() || !addMemberForm.email.trim()) {
      setToast({ message: "Name and email are required.", type: "error" });
      return;
    }
    if (!isValidEmail(addMemberForm.email)) {
      setToast({ message: "Email is not valid.", type: "error" });
      return;
    }
    if (addMemberForm.position_key === "custom" && !addMemberForm.custom_position_label.trim()) {
      setToast({ message: "Custom role needs a label.", type: "error" });
      return;
    }
    if (addMemberForm.member_kind === "center_admin") {
      const { data: existingAdmin } = await supabase
        .from("bpo_center_lead_team_members")
        .select("id")
        .eq("center_lead_id", centerLeadId)
        .eq("member_kind", "center_admin")
        .maybeSingle();
      if (existingAdmin) {
        await supabase.from("bpo_center_lead_team_members").update({ member_kind: "team_member" }).eq("id", existingAdmin.id);
      }
    }
    setSaving(true);
    const nextOrder = team.length ? Math.max(...team.map((t) => t.sort_order)) + 1 : 0;
    const { error } = await supabase.from("bpo_center_lead_team_members").insert({
      center_lead_id: centerLeadId,
      member_kind: addMemberForm.member_kind,
      full_name: addMemberForm.full_name.trim(),
      email: addMemberForm.email.trim().toLowerCase(),
      phone: addMemberForm.phone.trim() || null,
      position_key: addMemberForm.position_key,
      custom_position_label: addMemberForm.position_key === "custom" ? addMemberForm.custom_position_label.trim() : null,
      sort_order: nextOrder,
    });
    setSaving(false);
    if (error) {
      setToast({ message: error.message, type: "error" });
      return;
    }
    setAddMemberForm({
      full_name: "",
      email: "",
      phone: "",
      position_key: "closer",
      custom_position_label: "",
      member_kind: "team_member",
    });
    setToast({ message: "Team member added.", type: "success" });
    await loadDetail();
  }, [addMemberForm, canEdit, centerLeadId, loadDetail, supabase, team]);

  const applyDqed = useCallback(async () => {
    if (!centerLeadId || !draft) return;
    if (!canEdit) {
      setToast({ message: "You do not have permission to edit this centre lead.", type: "error" });
      return;
    }
    if (dqedCode.trim() !== getExpectedDqedCode()) {
      setToast({ message: "Activation code does not match.", type: "error" });
      return;
    }
    if (dqedPhrase.trim().length < 8) {
      setToast({ message: "Confirmation phrase too short.", type: "error" });
      return;
    }
    setSaving(true);
    const summary = `DQED: ${draft.centre_display_name}. ${dqedPhrase.trim()}.`;
    const { error: e1 } = await supabase.from("bpo_center_lead_offboarding_events").insert({
      center_lead_id: centerLeadId,
      confirmation_phrase: dqedPhrase.trim(),
      summary,
      performed_by: currentUserId,
    });
    if (e1) {
      setSaving(false);
      setToast({ message: e1.message, type: "error" });
      return;
    }
    const { error: e2 } = await supabase
      .from("bpo_center_leads")
      .update({ stage: "dqed", updated_by: currentUserId })
      .eq("id", centerLeadId);
    setSaving(false);
    if (e2) {
      setToast({ message: e2.message, type: "error" });
      return;
    }
    setDqedPhrase("");
    setDqedCode("");
    setToast({ message: "Marked DQED.", type: "success" });
    await loadDetail();
    setDraft((d) => (d ? { ...d, stage: "dqed" } : d));
  }, [canEdit, centerLeadId, currentUserId, dqedCode, dqedPhrase, draft, loadDetail, supabase]);

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
                BPO Centre Leads are currently available to System Admin users only.
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
        <div
          className="fixed bottom-6 right-6 z-[5100] rounded-xl px-4 py-3 text-sm font-semibold shadow-lg"
          style={{ background: toast.type === "success" ? "#166534" : "#991b1b", color: "#fff", fontFamily: T.font }}
        >
          {toast.message}
          <button type="button" className="ml-3 underline" onClick={() => setToast(null)}>
            Dismiss
          </button>
        </div>
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

          {/* Prev/Next navigation */}
          {allLeadIds && allLeadIds.length > 1 && (
            <div style={{ display: "flex", gap: 4 }}>
              <button
                type="button"
                disabled={!prevLeadId}
                onClick={() => {
                  if (!prevLeadId || !centerLeadId) return;
                  const path = window.location.pathname.replace(centerLeadId, prevLeadId);
                  router.push(path);
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  background: "#fff",
                  cursor: prevLeadId ? "pointer" : "not-allowed",
                  opacity: prevLeadId ? 1 : 0.4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: T.textMid,
                }}
                aria-label="Previous centre"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                disabled={!nextLeadId}
                onClick={() => {
                  if (!nextLeadId || !centerLeadId) return;
                  const path = window.location.pathname.replace(centerLeadId, nextLeadId);
                  router.push(path);
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  background: "#fff",
                  cursor: nextLeadId ? "pointer" : "not-allowed",
                  opacity: nextLeadId ? 1 : 0.4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: T.textMid,
                }}
                aria-label="Next centre"
              >
                <ChevronRight size={14} />
              </button>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, alignSelf: "center", marginLeft: 4 }}>
                {currentIdx + 1}/{allLeadIds.length}
              </span>
            </div>
          )}

          <TabNavigation
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={["Overview", "Team", "Resources", "Credentials"]}
          />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            type="button"
            disabled={isDisabled || saving}
            onClick={() => void saveCentreLead()}
            style={{
              height: 34,
              padding: "0 16px",
              borderRadius: 8,
              border: "none",
              background: BRAND_GREEN,
              color: "#fff",
              fontSize: 12,
              fontWeight: 800,
              cursor: isDisabled || saving ? "not-allowed" : "pointer",
              opacity: isDisabled || saving ? 0.55 : 1,
              transition: "all 0.15s ease-in-out",
            }}
          >
            {saving ? "Saving..." : "Save"}
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 18, alignItems: "start" }}>
          {/* LEFT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Section 1: Profile Details */}
            <div
              style={{
                background: "#fff",
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                padding: "20px 22px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              {/* Stage badge + name */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    padding: "4px 10px",
                    borderRadius: 6,
                    color: "#fff",
                    background: STAGE_COLOR[draft.stage] ?? BRAND_GREEN,
                  }}
                >
                  {STAGE_LABEL[draft.stage] ?? draft.stage}
                </span>
                {draft.last_call_result && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: 6,
                      background: draft.last_call_result === "call_completed" ? "#dcfce7" : "#fef3c7",
                      color: draft.last_call_result === "call_completed" ? "#166534" : "#92400e",
                      border: `1px solid ${draft.last_call_result === "call_completed" ? "#86efac" : "#fcd34d"}`,
                    }}
                  >
                    {formatCallResultLabel(draft.last_call_result)}
                    {draft.last_call_result_at && (
                      <> &mdash; {new Date(draft.last_call_result_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</>
                    )}
                  </span>
                )}
              </div>

              {/* Key fields grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
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
                  <label style={labelStyle}>Stage</label>
                  <Select
                    value={draft.stage}
                    disabled={isDisabled}
                    onValueChange={(v) => v && setDraft({ ...draft, stage: v as CenterLeadStage })}
                  >
                    <SelectTrigger
                      className="!h-auto w-full"
                      style={{
                        minHeight: 36,
                        borderRadius: 8,
                        border: `1px solid ${T.border}`,
                        fontWeight: 700,
                        fontSize: 13,
                        paddingLeft: 12,
                        paddingRight: 10,
                        backgroundColor: isDisabled ? T.pageBg : "#fff",
                        opacity: isDisabled ? 0.65 : 1,
                        fontFamily: T.font,
                      }}
                    >
                      <SelectValue>{STAGE_LABEL[draft.stage]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {STAGE_OPTIONS.map((o) => (
                        <SelectItem key={o.key} value={o.key}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <label style={labelStyle}>Opportunity value</label>
                  <input
                    type="number"
                    value={draft.opportunity_value ?? ""}
                    disabled={isDisabled}
                    onChange={(e) => setDraft({ ...draft, opportunity_value: e.target.value === "" ? null : Number(e.target.value) })}
                    style={{ ...fieldStyle, opacity: isDisabled ? 0.65 : 1 }}
                    onFocus={fieldFocus}
                    onBlur={fieldBlur}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Source</label>
                  <input
                    value={draft.opportunity_source ?? ""}
                    disabled={isDisabled}
                    onChange={(e) => setDraft({ ...draft, opportunity_source: e.target.value })}
                    style={{ ...fieldStyle, opacity: isDisabled ? 0.65 : 1 }}
                    onFocus={fieldFocus}
                    onBlur={fieldBlur}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Lead vendor</label>
                  <input
                    value={draft.lead_vendor_label ?? ""}
                    disabled={isDisabled}
                    onChange={(e) => setDraft({ ...draft, lead_vendor_label: e.target.value })}
                    style={{ ...fieldStyle, opacity: isDisabled ? 0.65 : 1 }}
                    onFocus={fieldFocus}
                    onBlur={fieldBlur}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Linked CRM centre</label>
                  <input
                    value={draft.linked_crm_centre_label ?? ""}
                    disabled={isDisabled}
                    onChange={(e) => setDraft({ ...draft, linked_crm_centre_label: e.target.value })}
                    style={{ ...fieldStyle, opacity: isDisabled ? 0.65 : 1 }}
                    onFocus={fieldFocus}
                    onBlur={fieldBlur}
                  />
                </div>
              </div>

              {/* Owner/team quick summary */}
              {team.length > 0 && (
                <div style={{ marginTop: 16, padding: "10px 12px", background: "#f8faf6", borderRadius: 8, border: `1px solid ${T.borderLight}` }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: T.textMuted, textTransform: "uppercase", marginBottom: 6 }}>Team ({team.length})</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {team.slice(0, 6).map((m) => (
                      <span
                        key={m.id}
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: m.member_kind === "center_admin" ? "#dcfce7" : "#f1f5f9",
                          color: m.member_kind === "center_admin" ? "#166534" : T.textMid,
                          border: `1px solid ${m.member_kind === "center_admin" ? "#86efac" : T.border}`,
                        }}
                      >
                        {m.full_name} ({m.position_key === "custom" ? m.custom_position_label : m.position_key})
                      </span>
                    ))}
                    {team.length > 6 && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, alignSelf: "center" }}>+{team.length - 6} more</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Last Disposition / Notes (Bottom Left) */}
            <div
              style={{
                background: "#fff",
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                padding: "18px 22px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: BRAND_GREEN, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                Notes & Disposition
              </div>

              {/* Last disposition */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Last disposition</label>
                <textarea
                  value={draft.last_disposition_text ?? ""}
                  disabled={isDisabled}
                  onChange={(e) => setDraft({ ...draft, last_disposition_text: e.target.value })}
                  rows={2}
                  style={{ ...fieldStyle, resize: "vertical", minHeight: 56, opacity: isDisabled ? 0.65 : 1 }}
                  onFocus={fieldFocus}
                  onBlur={fieldBlur}
                />
              </div>

              {/* Add new note */}
              <div style={{ marginBottom: 12 }}>
                <textarea
                  value={noteDraft}
                  disabled={isDisabled}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={2}
                  placeholder="Add a note..."
                  style={{ ...fieldStyle, resize: "vertical", minHeight: 56, opacity: isDisabled ? 0.65 : 1 }}
                  onFocus={fieldFocus}
                  onBlur={fieldBlur}
                />
                <button
                  type="button"
                  disabled={isDisabled || saving || !noteDraft.trim()}
                  onClick={() => void addNote()}
                  style={{
                    marginTop: 8,
                    height: 30,
                    padding: "0 12px",
                    borderRadius: 8,
                    border: "none",
                    background: BRAND_GREEN,
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: isDisabled || saving ? "not-allowed" : "pointer",
                    opacity: isDisabled || saving || !noteDraft.trim() ? 0.5 : 1,
                  }}
                >
                  Save note
                </button>
              </div>

              {/* Note history */}
              <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {notes.length === 0 ? (
                  <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>No notes yet.</div>
                ) : (
                  notes.map((n) => (
                    <div key={n.id} style={{ padding: "10px 12px", borderRadius: 8, background: "#f8faf6", border: `1px solid ${T.borderLight}` }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: T.textMuted, marginBottom: 4 }}>
                        {new Date(n.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </div>
                      <div style={{ fontSize: 12, color: T.textDark, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{n.body}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Danger zone (collapsible) */}
            {!isDqed && (
              <LeadCard icon="⚠️" title="Danger zone" subtitle="Offboarding audit action" defaultExpanded={false}>
                <div style={{ borderRadius: 12, border: "1.5px solid #fecaca", backgroundColor: "#fef2f2", padding: 14 }}>
                  <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#7f1d1d", lineHeight: 1.5 }}>
                    Marking a centre lead as DQED logs an offboarding record.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <input
                      placeholder="Confirmation phrase (8+ chars)"
                      value={dqedPhrase}
                      disabled={!canEdit || saving}
                      onChange={(e) => setDqedPhrase(e.target.value)}
                      style={{ ...fieldStyle, fontSize: 12 }}
                      onFocus={fieldFocus}
                      onBlur={fieldBlur}
                    />
                    <input
                      placeholder="Activation code"
                      value={dqedCode}
                      disabled={!canEdit || saving}
                      onChange={(e) => setDqedCode(e.target.value)}
                      style={{ ...fieldStyle, fontSize: 12 }}
                      onFocus={fieldFocus}
                      onBlur={fieldBlur}
                    />
                  </div>
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      disabled={!canEdit || saving}
                      onClick={() => void applyDqed()}
                      style={{
                        border: "none",
                        borderRadius: 8,
                        background: "#b91c1c",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 800,
                        padding: "8px 14px",
                        cursor: !canEdit || saving ? "not-allowed" : "pointer",
                        opacity: !canEdit || saving ? 0.65 : 1,
                      }}
                    >
                      Confirm DQED
                    </button>
                  </div>
                </div>
              </LeadCard>
            )}
          </div>

          {/* RIGHT COLUMN: Call Result Update Panel */}
          <div
            style={{
              background: "#fff",
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              padding: "18px 20px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              position: "sticky",
              top: 20,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: BRAND_GREEN, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.3px" }}>
              Call update
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Disposition</label>
              <input
                value={callDisposition}
                disabled={isDisabled}
                onChange={(e) => setCallDisposition(e.target.value)}
                placeholder="What happened on the call?"
                style={{ ...fieldStyle, opacity: isDisabled ? 0.65 : 1 }}
                onFocus={fieldFocus}
                onBlur={fieldBlur}
              />
            </div>

            <label style={labelStyle}>Notes</label>
            <textarea
              value={callNotes}
              disabled={isDisabled}
              onChange={(e) => setCallNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={3}
              style={{ ...fieldStyle, marginBottom: 10, resize: "vertical", minHeight: 70, opacity: isDisabled ? 0.65 : 1 }}
              onFocus={fieldFocus}
              onBlur={fieldBlur}
            />
            <button
              type="button"
              disabled={isDisabled || saving}
              onClick={() => void logCallUpdate()}
              style={{
                width: "100%",
                height: 36,
                borderRadius: 8,
                border: "none",
                background: BRAND_GREEN,
                color: "#fff",
                fontSize: 11,
                fontWeight: 900,
                cursor: isDisabled || saving ? "not-allowed" : "pointer",
                opacity: isDisabled || saving ? 0.6 : 1,
                fontFamily: T.font,
                letterSpacing: "0.02em",
                marginBottom: 12,
              }}
            >
              Log call update
            </button>

            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              <button
                type="button"
                disabled={isDisabled || saving}
                onClick={() => void addCallResult("call_completed")}
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: 8,
                  border: "none",
                  background: "#166534",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 900,
                  cursor: isDisabled || saving ? "not-allowed" : "pointer",
                  opacity: isDisabled || saving ? 0.6 : 1,
                  fontFamily: T.font,
                  letterSpacing: "0.02em",
                }}
              >
                Call Completed
              </button>
              <button
                type="button"
                disabled={isDisabled || saving}
                onClick={() => void addCallResult("no_pickup")}
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: 8,
                  border: "none",
                  background: "#6b7280",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 900,
                  cursor: isDisabled || saving ? "not-allowed" : "pointer",
                  opacity: isDisabled || saving ? 0.6 : 1,
                  fontFamily: T.font,
                  letterSpacing: "0.02em",
                }}
              >
                No Pickup
              </button>
            </div>

            {/* Activity feed */}
            <div style={{ maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {activityFeed.length === 0 ? (
                <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600, textAlign: "center", padding: 16 }}>
                  No activity logged yet.
                </div>
              ) : (
                activityFeed.map((item) => {
                  const isCall = item.kind === "call";
                  const title = isCall ? formatCallResultLabel(item.code) : "Note";
                  const chipBg = isCall ? "#dcfce7" : "#eef2ff";
                  const chipBorder = isCall ? "#86efac" : "#c7d2fe";
                  const chipText = isCall ? "#166534" : "#3730a3";
                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: `1px solid ${T.borderLight}`,
                        background: "#fafafa",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: item.body ? 6 : 0 }}>
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
                      {item.body && (
                        <div style={{ fontSize: 11, color: T.textMid, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                          {item.body}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : activeTab === "Team" ? (
        /* ═══════════════ TEAM TAB ═══════════════ */
        <div style={{ maxWidth: 1200 }}>
          <LeadCard icon="👥" title="Centre admin & team" subtitle="Onboarding team roster" collapsible={false}>
            <ShadcnTable>
              <TableHeader>
                <TableRow style={{ backgroundColor: BRAND_GREEN, borderBottom: "none" }} className="hover:bg-transparent">
                  {[
                    { label: "Role", align: "left" as const },
                    { label: "Name", align: "left" as const },
                    { label: "Email", align: "left" as const },
                    { label: "Position", align: "left" as const },
                  ].map(({ label, align }) => (
                    <TableHead
                      key={label}
                      style={{
                        color: "#ffffff",
                        fontWeight: 700,
                        fontSize: 12,
                        letterSpacing: "0.3px",
                        padding: "14px 16px",
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
                {team.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} style={{ color: T.textMuted }}>
                      No team yet — send the intake link or add members below.
                    </TableCell>
                  </TableRow>
                ) : (
                  team.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell style={{ padding: "12px 16px" }}>
                        <span
                          className="rounded-md px-2 py-0.5 text-[11px] font-extrabold uppercase"
                          style={{
                            background: m.member_kind === "center_admin" ? "#dcfce7" : T.blueFaint,
                            color: m.member_kind === "center_admin" ? "#166534" : T.textMid,
                          }}
                        >
                          {m.member_kind === "center_admin" ? "Admin" : "Member"}
                        </span>
                      </TableCell>
                      <TableCell style={{ padding: "12px 16px", fontWeight: 800 }}>{m.full_name}</TableCell>
                      <TableCell style={{ padding: "12px 16px", fontSize: 13 }}>{m.email}</TableCell>
                      <TableCell style={{ padding: "12px 16px", fontSize: 13 }}>
                        {m.position_key === "custom" ? m.custom_position_label : m.position_key}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </ShadcnTable>

            {!isDqed && (
              <div style={{ marginTop: 16, borderRadius: 12, border: `1px solid ${T.border}`, padding: "12px 14px", backgroundColor: T.blueFaint }}>
                <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 900, color: T.textMuted }}>Add team member</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5" style={{ alignItems: "end" }}>
                  <input placeholder="Full name" value={addMemberForm.full_name} onChange={(e) => setAddMemberForm((f) => ({ ...f, full_name: e.target.value }))} style={{ ...fieldStyle, fontWeight: 500 }} onFocus={fieldFocus} onBlur={fieldBlur} />
                  <input placeholder="Email" type="text" inputMode="email" autoComplete="email" value={addMemberForm.email} onChange={(e) => setAddMemberForm((f) => ({ ...f, email: e.target.value }))} style={{ ...fieldStyle, fontWeight: 500 }} onFocus={fieldFocus} onBlur={fieldBlur} />
                  <input placeholder="Phone (optional)" value={addMemberForm.phone} onChange={(e) => setAddMemberForm((f) => ({ ...f, phone: e.target.value }))} style={{ ...fieldStyle, fontWeight: 500 }} onFocus={fieldFocus} onBlur={fieldBlur} />
                  <StyledSelect
                    value={addMemberForm.member_kind}
                    onValueChange={(v) => setAddMemberForm((f) => ({ ...f, member_kind: v as "center_admin" | "team_member" }))}
                    options={[{ value: "team_member", label: "Team member" }, { value: "center_admin", label: "Centre admin" }]}
                    placeholder="Kind"
                  />
                  <StyledSelect
                    value={addMemberForm.position_key}
                    onValueChange={(v) => setAddMemberForm((f) => ({ ...f, position_key: v as typeof addMemberForm.position_key }))}
                    options={[{ value: "owner", label: "Owner" }, { value: "manager", label: "Manager" }, { value: "closer", label: "Closer" }, { value: "custom", label: "Custom" }]}
                    placeholder="Position"
                  />
                  {addMemberForm.position_key === "custom" && (
                    <input
                      placeholder="Custom role label"
                      value={addMemberForm.custom_position_label}
                      onChange={(e) => setAddMemberForm((f) => ({ ...f, custom_position_label: e.target.value }))}
                      style={{ ...fieldStyle, fontWeight: 500 }}
                      className="lg:col-span-5"
                      onFocus={fieldFocus}
                      onBlur={fieldBlur}
                    />
                  )}
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void addTeamMember()}
                  style={{ marginTop: 8, height: 32, padding: "0 14px", borderRadius: 8, border: "none", background: BRAND_GREEN, color: "#fff", fontSize: 11, fontWeight: 900, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}
                >
                  Add to team
                </button>
              </div>
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
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: BRAND_GREEN, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                        Suggested from intake
                      </div>
                      <div style={{ fontSize: 12, color: T.textMid, fontWeight: 600 }}>
                        Admin: {intakeAdmin ? `${intakeAdmin.full_name} (${intakeAdmin.email})` : "Not set"} · Closer: {intakeCloser ? `${intakeCloser.full_name} (${intakeCloser.email})` : "Not set"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => setShowAdminProvision((v) => !v)}
                        style={{
                          height: 34,
                          padding: "0 12px",
                          borderRadius: 10,
                          border: `1px solid ${T.border}`,
                          background: "#fff",
                          color: BRAND_GREEN,
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        {showAdminProvision ? "Hide admin form" : "Create centre admin"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCloserProvision((v) => !v)}
                        style={{
                          height: 34,
                          padding: "0 12px",
                          borderRadius: 10,
                          border: `1px solid ${T.border}`,
                          background: "#fff",
                          color: BRAND_GREEN,
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        {showCloserProvision ? "Hide closer form" : "Create closer"}
                      </button>
                    </div>
                  </div>

                  {showAdminProvision && (
                    <div style={{ border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", background: "#fff" }}>
                      <UserEditorComponent
                        onClose={() => setShowAdminProvision(false)}
                        onSubmit={(data) => {
                          const fullName = `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
                          setProvisioned((p) => ({ ...p, adminEmail: data.email, adminName: fullName || p.adminName }));
                          setToast({ message: "Centre admin created.", type: "success" });
                        }}
                        presetRoleKey="call_center_admin"
                        allowedRoleKeys={["call_center_admin"]}
                        lockRole
                        prefill={{
                          fullName: intakeAdmin?.full_name ?? "",
                          email: intakeAdmin?.email ?? "",
                          phone: intakeAdmin?.phone ?? "",
                        }}
                      />
                    </div>
                  )}

                  {showCloserProvision && (
                    <div style={{ border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", background: "#fff" }}>
                      <UserEditorComponent
                        onClose={() => setShowCloserProvision(false)}
                        onSubmit={(data) => {
                          const fullName = `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
                          setProvisioned((p) => ({ ...p, closerEmail: data.email, closerName: fullName || p.closerName }));
                          setToast({ message: "Closer created.", type: "success" });
                        }}
                        presetRoleKey="call_center_agent"
                        allowedRoleKeys={["call_center_agent"]}
                        lockRole
                        prefill={{
                          fullName: intakeCloser?.full_name ?? "",
                          email: intakeCloser?.email ?? "",
                          phone: intakeCloser?.phone ?? "",
                        }}
                      />
                    </div>
                  )}

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
                      href={`mailto:${encodeURIComponent(provisioned.adminEmail || intakeAdmin?.email || "")}?subject=${encodeURIComponent(credentialsEmail.subject)}&body=${encodeURIComponent(credentialsEmail.body)}`}
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
    </div>
  );
}
