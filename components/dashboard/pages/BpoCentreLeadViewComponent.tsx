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
import { ClipboardCopy, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";
import { LeadCard } from "@/components/dashboard/pages/LeadCard";

const BRAND_GREEN = "#233217";

type CenterLeadStage =
  | "pre_onboarding"
  | "ready_for_onboarding_meeting"
  | "onboarding_completed"
  | "actively_selling"
  | "needs_attention"
  | "on_pause"
  | "dqed";

type DetailTab = "Opportunity Details" | "Team" | "Call activity" | "Resources" | "Notes";

const STAGE_OPTIONS: { key: CenterLeadStage; label: string }[] = [
  { key: "pre_onboarding", label: "Pre-onboarding" },
  { key: "ready_for_onboarding_meeting", label: "Ready for onboarding meeting" },
  { key: "onboarding_completed", label: "Onboarding completed" },
  { key: "actively_selling", label: "Actively selling" },
  { key: "needs_attention", label: "Needs attention" },
  { key: "on_pause", label: "On pause" },
  { key: "dqed", label: "DQED" },
];

const STAGE_LABEL: Record<string, string> = Object.fromEntries(STAGE_OPTIONS.map((o) => [o.key, o.label]));

function getExpectedDqedCode(): string {
  return (
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BPO_ONBOARDING_DQED_CODE) || "DQED-CONFIRM"
  );
}

function formatCallResultLabel(key: string | null): string {
  if (!key) return "";
  return key.replace(/_/g, " ");
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
  fontSize: 12,
  fontWeight: 700,
  color: T.textMuted,
  marginBottom: 5,
  display: "block",
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
              height: 34,
              padding: "0 14px",
              borderRadius: 10,
              border: "none",
              background: isActive ? BRAND_GREEN : "transparent",
              color: isActive ? "#fff" : T.textMuted,
              fontSize: 13,
              fontWeight: 600,
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
}: {
  centerLeadId?: string;
  canEdit: boolean;
  onBack: () => void;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const { currentUserId, currentRole } = useDashboardContext();

  const [activeTab, setActiveTab] = useState<DetailTab>("Opportunity Details");
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
  const [callNotes, setCallNotes] = useState("");
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
    // Defer the state updates to avoid synchronous setState-in-effect lint.
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

      {/* Match Lead details header chrome (Back icon + tabs + actions) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "#fff",
              border: `1.5px solid ${T.border}`,
              borderRadius: "12px",
              width: 42,
              height: 42,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: T.textMid,
              transition: "all 0.2s",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
              flexShrink: 0,
            }}
            aria-label="Back"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <TabNavigation
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={["Opportunity Details", "Team", "Call activity", "Resources", "Notes"]}
          />
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            type="button"
            disabled={!canEdit || saving || draft?.stage === "dqed"}
            onClick={() => void saveCentreLead()}
            style={{
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusMd,
              background: T.cardBg,
              color: "#233217",
              fontSize: 13,
              fontWeight: 700,
              padding: "10px 20px",
              cursor: !canEdit || saving || draft?.stage === "dqed" ? "not-allowed" : "pointer",
              opacity: !canEdit || saving || draft?.stage === "dqed" ? 0.55 : 1,
              transition: "all 0.15s ease-in-out",
            }}
            onMouseEnter={(e) => {
              if (!canEdit || saving || draft?.stage === "dqed") return;
              e.currentTarget.style.backgroundColor = "#233217";
              e.currentTarget.style.color = "#fff";
              e.currentTarget.style.borderColor = "#233217";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = T.cardBg;
              e.currentTarget.style.color = "#233217";
              e.currentTarget.style.borderColor = T.border;
            }}
          >
            Save
          </button>

          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(publicOpenIntakeUrl);
              setToast({ message: "Public intake link copied.", type: "success" });
            }}
            disabled={!publicOpenIntakeUrl}
            style={{
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusMd,
              background: "#fff",
              color: "#233217",
              fontSize: 13,
              fontWeight: 700,
              padding: "10px 20px",
              cursor: publicOpenIntakeUrl ? "pointer" : "not-allowed",
              opacity: publicOpenIntakeUrl ? 1 : 0.55,
              transition: "all 0.15s ease-in-out",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <ClipboardCopy size={16} />
            Copy public intake link
          </button>

          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(leadInviteUrl);
              setToast({ message: "This-lead invite link copied.", type: "success" });
            }}
            disabled={!leadInviteUrl}
            style={{
              border: `1px solid ${leadInviteUrl ? "#233217" : T.border}`,
              borderRadius: T.radiusMd,
              background: leadInviteUrl ? "#233217" : T.cardBg,
              color: leadInviteUrl ? "#fff" : "#233217",
              fontSize: 13,
              fontWeight: 700,
              padding: "10px 24px",
              cursor: leadInviteUrl ? "pointer" : "not-allowed",
              opacity: leadInviteUrl ? 1 : 0.65,
              transition: "all 0.15s ease-in-out",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
            onMouseEnter={(e) => {
              if (!leadInviteUrl) return;
              e.currentTarget.style.backgroundColor = "#1a260f";
              e.currentTarget.style.borderColor = "#1a260f";
            }}
            onMouseLeave={(e) => {
              if (!leadInviteUrl) return;
              e.currentTarget.style.backgroundColor = "#233217";
              e.currentTarget.style.borderColor = "#233217";
            }}
          >
            <ClipboardCopy size={16} />
            Copy this-lead link
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
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {activeTab === "Opportunity Details" && (
            <div style={{ maxWidth: 1200, display: "flex", flexDirection: "column", gap: 16 }}>
              <LeadCard
                icon="🏢"
                title="Opportunity Details"
                subtitle="Centre profile and intake notes"
                collapsible={false}
              >
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20, marginBottom: 6 }}>
                  <div>
                    <label style={labelStyle}>Centre display name</label>
                    <input
                      value={draft.centre_display_name}
                      disabled={!canEdit || draft.stage === "dqed"}
                      onChange={(e) => setDraft({ ...draft, centre_display_name: e.target.value })}
                      style={{ ...fieldStyle, opacity: !canEdit || draft.stage === "dqed" ? 0.65 : 1 }}
                      onFocus={fieldFocus}
                      onBlur={fieldBlur}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Stage</label>
                    <Select
                      value={draft.stage}
                      disabled={!canEdit || draft.stage === "dqed"}
                      onValueChange={(v) => v && setDraft({ ...draft, stage: v as CenterLeadStage })}
                    >
                      <SelectTrigger
                        className="!h-auto w-full"
                        style={{
                          minHeight: 38,
                          borderRadius: 8,
                          border: `1px solid ${T.border}`,
                          fontWeight: 700,
                          fontSize: 13,
                          paddingLeft: 12,
                          paddingRight: 10,
                          backgroundColor: !canEdit || draft.stage === "dqed" ? T.pageBg : "#fff",
                          opacity: !canEdit || draft.stage === "dqed" ? 0.65 : 1,
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
                    <label style={labelStyle}>Opportunity value</label>
                    <input
                      type="number"
                      value={draft.opportunity_value ?? ""}
                      disabled={!canEdit || draft.stage === "dqed"}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          opportunity_value: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      style={{ ...fieldStyle, opacity: !canEdit || draft.stage === "dqed" ? 0.65 : 1 }}
                      onFocus={fieldFocus}
                      onBlur={fieldBlur}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Opportunity source</label>
                    <input
                      value={draft.opportunity_source ?? ""}
                      disabled={!canEdit || draft.stage === "dqed"}
                      onChange={(e) => setDraft({ ...draft, opportunity_source: e.target.value })}
                      style={{ ...fieldStyle, opacity: !canEdit || draft.stage === "dqed" ? 0.65 : 1 }}
                      onFocus={fieldFocus}
                      onBlur={fieldBlur}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Lead vendor label</label>
                    <input
                      value={draft.lead_vendor_label ?? ""}
                      disabled={!canEdit || draft.stage === "dqed"}
                      onChange={(e) => setDraft({ ...draft, lead_vendor_label: e.target.value })}
                      style={{ ...fieldStyle, opacity: !canEdit || draft.stage === "dqed" ? 0.65 : 1 }}
                      onFocus={fieldFocus}
                      onBlur={fieldBlur}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Linked CRM centre (label)</label>
                    <input
                      value={draft.linked_crm_centre_label ?? ""}
                      disabled={!canEdit || draft.stage === "dqed"}
                      onChange={(e) => setDraft({ ...draft, linked_crm_centre_label: e.target.value })}
                      style={{ ...fieldStyle, opacity: !canEdit || draft.stage === "dqed" ? 0.65 : 1 }}
                      onFocus={fieldFocus}
                      onBlur={fieldBlur}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Expected start</label>
                    <input
                      type="date"
                      value={draft.expected_start_date ?? ""}
                      disabled={!canEdit || draft.stage === "dqed"}
                      onChange={(e) => setDraft({ ...draft, expected_start_date: e.target.value || null })}
                      style={{ ...fieldStyle, opacity: !canEdit || draft.stage === "dqed" ? 0.65 : 1 }}
                      onFocus={fieldFocus}
                      onBlur={fieldBlur}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Committed daily sales</label>
                    <input
                      type="number"
                      value={draft.committed_daily_sales ?? ""}
                      disabled={!canEdit || draft.stage === "dqed"}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          committed_daily_sales: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      style={{ ...fieldStyle, opacity: !canEdit || draft.stage === "dqed" ? 0.65 : 1 }}
                      onFocus={fieldFocus}
                      onBlur={fieldBlur}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Closer count</label>
                    <input
                      type="number"
                      value={draft.closer_count ?? ""}
                      disabled={!canEdit || draft.stage === "dqed"}
                      onChange={(e) =>
                        setDraft({ ...draft, closer_count: e.target.value === "" ? null : Number(e.target.value) })
                      }
                      style={{ ...fieldStyle, opacity: !canEdit || draft.stage === "dqed" ? 0.65 : 1 }}
                      onFocus={fieldFocus}
                      onBlur={fieldBlur}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20, marginTop: 18 }}>
                  {[
                    ["buyer_details", "Buyer details"],
                    ["daily_sales_generation_notes", "Daily sales generation notes"],
                    ["trending_metrics_notes", "Trending metrics notes"],
                    ["owner_manager_contact_notes", "Owner manager contact notes"],
                    ["last_disposition_text", "Last disposition text"],
                  ].map(([field, label]) => (
                    <div key={field} style={field === "last_disposition_text" ? { gridColumn: "1 / -1" } : undefined}>
                      <label style={labelStyle}>{label}</label>
                      <textarea
                        value={(draft as unknown as Record<string, string>)[field] ?? ""}
                        disabled={!canEdit || draft.stage === "dqed"}
                        onChange={(e) => setDraft({ ...draft, [field]: e.target.value } as CenterLeadRow)}
                        rows={field === "last_disposition_text" ? 3 : 4}
                        style={{
                          ...fieldStyle,
                          minHeight: field === "last_disposition_text" ? 80 : 90,
                          resize: "vertical",
                          fontWeight: 500,
                          opacity: !canEdit || draft.stage === "dqed" ? 0.65 : 1,
                        }}
                        onFocus={fieldFocus}
                        onBlur={fieldBlur}
                      />
                    </div>
                  ))}
                </div>
              </LeadCard>

              <LeadCard icon="🔐" title="Credentials log" subtitle="Track access and DID provisioning" defaultExpanded={true}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, marginBottom: 10 }}>
                    <input
                      placeholder="Slack"
                      value={credForm.slack}
                      disabled={!canEdit || draft.stage === "dqed"}
                      onChange={(e) => setCredForm((f) => ({ ...f, slack: e.target.value }))}
                      style={{ ...fieldStyle, opacity: !canEdit || draft.stage === "dqed" ? 0.65 : 1, fontWeight: 500 }}
                      onFocus={fieldFocus}
                      onBlur={fieldBlur}
                    />
                    <input
                      placeholder="CRM access"
                      value={credForm.crm}
                      disabled={!canEdit || draft.stage === "dqed"}
                      onChange={(e) => setCredForm((f) => ({ ...f, crm: e.target.value }))}
                      style={{ ...fieldStyle, opacity: !canEdit || draft.stage === "dqed" ? 0.65 : 1, fontWeight: 500 }}
                      onFocus={fieldFocus}
                      onBlur={fieldBlur}
                    />
                    <input
                      placeholder="DID"
                      value={credForm.did}
                      disabled={!canEdit || draft.stage === "dqed"}
                      onChange={(e) => setCredForm((f) => ({ ...f, did: e.target.value }))}
                      style={{ ...fieldStyle, opacity: !canEdit || draft.stage === "dqed" ? 0.65 : 1, fontWeight: 500 }}
                      onFocus={fieldFocus}
                      onBlur={fieldBlur}
                    />
                  </div>
                  <textarea
                    placeholder="Other notes"
                    value={credForm.other}
                    disabled={!canEdit || draft.stage === "dqed"}
                    onChange={(e) => setCredForm((f) => ({ ...f, other: e.target.value }))}
                    rows={2}
                    style={{ ...fieldStyle, marginBottom: 12, fontWeight: 500, opacity: !canEdit || draft.stage === "dqed" ? 0.65 : 1, resize: "vertical" }}
                    onFocus={fieldFocus}
                    onBlur={fieldBlur}
                  />
                  <button
                    type="button"
                    disabled={!canEdit || saving || draft.stage === "dqed"}
                    onClick={() => void logCredential()}
                    style={{
                      height: 34,
                      padding: "0 14px",
                      borderRadius: 10,
                      border: "none",
                      background: T.blueHover,
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 900,
                      fontFamily: T.font,
                      cursor: !canEdit || saving || draft.stage === "dqed" ? "not-allowed" : "pointer",
                      opacity: !canEdit || saving || draft.stage === "dqed" ? 0.6 : 1,
                    }}
                  >
                    Log credential entry
                  </button>
                  {credentials.length > 0 && (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                      {credentials.map((c) => (
                        <div
                          key={c.id}
                          style={{
                            borderRadius: 12,
                            border: `1px solid ${T.border}`,
                            backgroundColor: "#fff",
                            padding: "10px 12px",
                            fontSize: 12,
                            color: T.textDark,
                            fontFamily: T.font,
                          }}
                        >
                          <div style={{ fontWeight: 900 }}>{new Date(c.logged_at).toLocaleString()}</div>
                          {c.slack_account_details && <div>Slack: {c.slack_account_details}</div>}
                          {c.crm_access_details && <div>CRM: {c.crm_access_details}</div>}
                          {c.did_number && <div>DID: {c.did_number}</div>}
                          {c.other_notes && <div>{c.other_notes}</div>}
                        </div>
                      ))}
                    </div>
                  )}
              </LeadCard>

              <div style={{ marginTop: 2 }}>
                <LeadCard icon="⚠️" title="Danger zone" subtitle="Offboarding audit action" defaultExpanded={false}>
                  <div style={{ borderRadius: 14, border: "1.5px solid #fecaca", backgroundColor: "#fef2f2", padding: 16 }}>
                    <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#7f1d1d", lineHeight: 1.6 }}>
                      Marking a centre lead as DQED logs an offboarding record on separate audit tables.
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                      <input
                        placeholder="Confirmation phrase (8+ characters)"
                        value={dqedPhrase}
                        disabled={!canEdit || saving || draft.stage === "dqed"}
                        onChange={(e) => setDqedPhrase(e.target.value)}
                        style={{ ...fieldStyle, fontWeight: 600, opacity: !canEdit || draft.stage === "dqed" ? 0.65 : 1 }}
                        onFocus={fieldFocus}
                        onBlur={fieldBlur}
                      />
                      <input
                        placeholder="Activation code"
                        value={dqedCode}
                        disabled={!canEdit || saving || draft.stage === "dqed"}
                        onChange={(e) => setDqedCode(e.target.value)}
                        style={{ ...fieldStyle, fontWeight: 600, opacity: !canEdit || draft.stage === "dqed" ? 0.65 : 1 }}
                        onFocus={fieldFocus}
                        onBlur={fieldBlur}
                      />
                    </div>
                    <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        disabled={!canEdit || saving || draft.stage === "dqed"}
                        onClick={() => void applyDqed()}
                        style={{
                          border: "1px solid #b91c1c",
                          borderRadius: T.radiusMd,
                          background: "#b91c1c",
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: 800,
                          padding: "10px 18px",
                          cursor: !canEdit || saving || draft.stage === "dqed" ? "not-allowed" : "pointer",
                          opacity: !canEdit || saving || draft.stage === "dqed" ? 0.65 : 1,
                          transition: "all 0.15s ease-in-out",
                        }}
                      >
                        Confirm DQED
                      </button>
                    </div>
                  </div>
                </LeadCard>
              </div>
              </div>
            )}

            {activeTab === "Team" && (
              <div style={{ maxWidth: 1200 }}>
                <LeadCard icon="👥" title="Centre admin & team" subtitle="Onboarding team roster" collapsible={false}>
                <ShadcnTable>
                  <TableHeader>
                    <TableRow style={{ background: T.blueFaint }}>
                      <TableHead style={{ fontWeight: 900, color: BRAND_GREEN }}>Role</TableHead>
                      <TableHead style={{ fontWeight: 900, color: BRAND_GREEN }}>Name</TableHead>
                      <TableHead style={{ fontWeight: 900, color: BRAND_GREEN }}>Email</TableHead>
                      <TableHead style={{ fontWeight: 900, color: BRAND_GREEN }}>Position</TableHead>
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
                          <TableCell>
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
                          <TableCell style={{ fontWeight: 800 }}>{m.full_name}</TableCell>
                          <TableCell style={{ fontSize: 13 }}>{m.email}</TableCell>
                          <TableCell style={{ fontSize: 13 }}>
                            {m.position_key === "custom" ? m.custom_position_label : m.position_key}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </ShadcnTable>

                {draft.stage !== "dqed" && (
                  <div
                    style={{
                      marginTop: 18,
                      borderRadius: 14,
                      border: `1px solid ${T.border}`,
                      padding: "14px 16px",
                      backgroundColor: T.blueFaint,
                    }}
                  >
                    <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 900, color: T.textMuted, fontFamily: T.font }}>
                      Add team member
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                      <input
                        placeholder="Full name"
                        value={addMemberForm.full_name}
                        onChange={(e) => setAddMemberForm((f) => ({ ...f, full_name: e.target.value }))}
                        style={{ ...fieldStyle, fontWeight: 500 }}
                        onFocus={fieldFocus}
                        onBlur={fieldBlur}
                      />
                      <input
                        placeholder="Email"
                        type="email"
                        value={addMemberForm.email}
                        onChange={(e) => setAddMemberForm((f) => ({ ...f, email: e.target.value }))}
                        style={{ ...fieldStyle, fontWeight: 500 }}
                        onFocus={fieldFocus}
                        onBlur={fieldBlur}
                      />
                      <input
                        placeholder="Phone (optional)"
                        value={addMemberForm.phone}
                        onChange={(e) => setAddMemberForm((f) => ({ ...f, phone: e.target.value }))}
                        style={{ ...fieldStyle, fontWeight: 500 }}
                        onFocus={fieldFocus}
                        onBlur={fieldBlur}
                      />
                      <Select
                        value={addMemberForm.member_kind}
                        onValueChange={(v) => setAddMemberForm((f) => ({ ...f, member_kind: v as "center_admin" | "team_member" }))}
                      >
                        <SelectTrigger className="!h-auto w-full" style={{ minHeight: 38, borderRadius: 8, border: `1px solid ${T.border}`, fontWeight: 700, fontSize: 13, paddingLeft: 12, paddingRight: 10, backgroundColor: "#fff", fontFamily: T.font }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="team_member">Team member</SelectItem>
                          <SelectItem value="center_admin">Centre administrator</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={addMemberForm.position_key}
                        onValueChange={(v) => setAddMemberForm((f) => ({ ...f, position_key: v as typeof addMemberForm.position_key }))}
                      >
                        <SelectTrigger className="!h-auto w-full" style={{ minHeight: 38, borderRadius: 8, border: `1px solid ${T.border}`, fontWeight: 700, fontSize: 13, paddingLeft: 12, paddingRight: 10, backgroundColor: "#fff", fontFamily: T.font }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">Owner</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="closer">Closer</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      {addMemberForm.position_key === "custom" && (
                        <input
                          placeholder="Custom role label"
                          value={addMemberForm.custom_position_label}
                          onChange={(e) => setAddMemberForm((f) => ({ ...f, custom_position_label: e.target.value }))}
                          style={{ ...fieldStyle, fontWeight: 500, gridColumn: "1 / -1" }}
                          onFocus={fieldFocus}
                          onBlur={fieldBlur}
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void addTeamMember()}
                      style={{
                        marginTop: 10,
                        height: 34,
                        padding: "0 14px",
                        borderRadius: 10,
                        border: "none",
                        background: BRAND_GREEN,
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 900,
                        fontFamily: T.font,
                        cursor: saving ? "not-allowed" : "pointer",
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      Add to team
                    </button>
                  </div>
                )}
                </LeadCard>
              </div>
            )}

            {activeTab === "Call activity" && (
              <div style={{ maxWidth: 1200 }}>
                <LeadCard icon="📞" title="Call updates" subtitle="Log call outcomes and notes" collapsible={false}>
                <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: T.textMuted, fontFamily: T.font }}>
                  Latest summary on the lead row is updated automatically from each entry below.
                </p>
                <textarea
                  value={callNotes}
                  disabled={!canEdit || draft.stage === "dqed"}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Optional notes"
                  rows={3}
                  style={{ ...fieldStyle, marginBottom: 10, fontWeight: 500, opacity: !canEdit || draft.stage === "dqed" ? 0.65 : 1, resize: "vertical" }}
                  onFocus={fieldFocus}
                  onBlur={fieldBlur}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
                  <button
                    type="button"
                    disabled={!canEdit || saving || draft.stage === "dqed"}
                    onClick={() => void addCallResult("call_completed")}
                    style={{ height: 34, padding: "0 14px", borderRadius: 10, border: "none", background: "#166534", color: "#fff", fontSize: 12, fontWeight: 900, fontFamily: T.font, cursor: !canEdit || saving || draft.stage === "dqed" ? "not-allowed" : "pointer", opacity: !canEdit || saving || draft.stage === "dqed" ? 0.6 : 1 }}
                  >
                    Call completed
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit || saving || draft.stage === "dqed"}
                    onClick={() => void addCallResult("no_pickup")}
                    style={{ height: 34, padding: "0 14px", borderRadius: 10, border: "none", background: "#6b7280", color: "#fff", fontSize: 12, fontWeight: 900, fontFamily: T.font, cursor: !canEdit || saving || draft.stage === "dqed" ? "not-allowed" : "pointer", opacity: !canEdit || saving || draft.stage === "dqed" ? 0.6 : 1 }}
                  >
                    No pickup
                  </button>
                </div>
                <ShadcnTable>
                  <TableHeader>
                    <TableRow style={{ background: T.blueFaint }}>
                      <TableHead style={{ fontWeight: 900, color: BRAND_GREEN }}>When</TableHead>
                      <TableHead style={{ fontWeight: 900, color: BRAND_GREEN }}>Result</TableHead>
                      <TableHead style={{ fontWeight: 900, color: BRAND_GREEN }}>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {callResults.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} style={{ color: T.textMuted }}>
                          No calls logged.
                        </TableCell>
                      </TableRow>
                    ) : (
                      callResults.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell style={{ fontSize: 12 }}>{new Date(c.recorded_at).toLocaleString()}</TableCell>
                          <TableCell style={{ fontWeight: 800 }}>{formatCallResultLabel(c.result_code)}</TableCell>
                          <TableCell style={{ fontSize: 13 }}>{c.notes ?? "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </ShadcnTable>
                </LeadCard>
              </div>
            )}

            {activeTab === "Resources" && (
              <div style={{ maxWidth: 1200, display: "flex", flexDirection: "column", gap: 16 }}>
                <LeadCard icon="📚" title="Universal library" subtitle="Resources available to all centre leads" defaultExpanded={true}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginBottom: 14 }}>
                  <input placeholder="Title" value={resGlobalForm.title} onChange={(e) => setResGlobalForm((f) => ({ ...f, title: e.target.value }))} style={{ ...fieldStyle, fontWeight: 500 }} onFocus={fieldFocus} onBlur={fieldBlur} />
                  <input placeholder="URL" value={resGlobalForm.url} onChange={(e) => setResGlobalForm((f) => ({ ...f, url: e.target.value }))} style={{ ...fieldStyle, fontWeight: 500 }} onFocus={fieldFocus} onBlur={fieldBlur} />
                  <textarea placeholder="Description" value={resGlobalForm.description} onChange={(e) => setResGlobalForm((f) => ({ ...f, description: e.target.value }))} rows={2} style={{ ...fieldStyle, fontWeight: 500, resize: "vertical", gridColumn: "1 / -1" }} onFocus={fieldFocus} onBlur={fieldBlur} />
                </div>
                <button
                  type="button"
                  disabled={!canEdit || saving}
                  onClick={() => void addResource("universal", resGlobalForm)}
                  style={{ height: 34, padding: "0 14px", borderRadius: 10, border: "none", background: T.blueHover, color: "#fff", fontSize: 12, fontWeight: 900, fontFamily: T.font, cursor: !canEdit || saving ? "not-allowed" : "pointer", opacity: !canEdit || saving ? 0.6 : 1, marginBottom: 16 }}
                >
                  Add universal resource
                </button>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
                  {resourcesUniversal.map((r) => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderRadius: 12, border: `1px solid ${T.border}`, padding: "10px 12px", fontSize: 13, fontFamily: T.font }}>
                      <span style={{ fontWeight: 800, color: T.textDark }}>{r.title}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {r.external_url && (
                          <a href={r.external_url} style={{ fontWeight: 800, color: BRAND_GREEN, textDecoration: "underline", fontSize: 12 }} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        )}
                        <button type="button" onClick={() => void deleteUniversalResource(r.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#b91c1c", padding: 2 }}>
                          <Trash2 size={14} />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
                </LeadCard>

                <LeadCard icon="🔗" title="This centre lead" subtitle="Lead-specific resources" defaultExpanded={true}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginBottom: 12 }}>
                  <input placeholder="Title" value={resLeadForm.title} onChange={(e) => setResLeadForm((f) => ({ ...f, title: e.target.value }))} style={{ ...fieldStyle, fontWeight: 500 }} onFocus={fieldFocus} onBlur={fieldBlur} />
                  <input placeholder="URL" value={resLeadForm.url} onChange={(e) => setResLeadForm((f) => ({ ...f, url: e.target.value }))} style={{ ...fieldStyle, fontWeight: 500 }} onFocus={fieldFocus} onBlur={fieldBlur} />
                  <textarea placeholder="Description" value={resLeadForm.description} onChange={(e) => setResLeadForm((f) => ({ ...f, description: e.target.value }))} rows={2} style={{ ...fieldStyle, fontWeight: 500, resize: "vertical", gridColumn: "1 / -1" }} onFocus={fieldFocus} onBlur={fieldBlur} />
                </div>
                <button
                  type="button"
                  disabled={!canEdit || saving || draft.stage === "dqed"}
                  onClick={() => void addResource("lead", resLeadForm)}
                  style={{ height: 34, padding: "0 14px", borderRadius: 10, border: "none", background: BRAND_GREEN, color: "#fff", fontSize: 12, fontWeight: 900, fontFamily: T.font, cursor: !canEdit || saving || draft.stage === "dqed" ? "not-allowed" : "pointer", opacity: !canEdit || saving || draft.stage === "dqed" ? 0.6 : 1 }}
                >
                  Add resource to this lead
                </button>
                {resourcesLead.length > 0 && (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                    {resourcesLead.map((r) => (
                      <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 12, border: `1px solid ${T.border}`, padding: "10px 12px", fontSize: 13, fontFamily: T.font }}>
                        <span style={{ fontWeight: 800, color: T.textDark }}>{r.title}</span>
                        {r.external_url && (
                          <a href={r.external_url} style={{ fontWeight: 800, color: BRAND_GREEN, textDecoration: "underline", fontSize: 12 }} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                </LeadCard>
              </div>
            )}

            {activeTab === "Notes" && (
              <div style={{ maxWidth: 1200 }}>
                <LeadCard icon="📝" title="Notes" subtitle="Internal notes for this centre lead" collapsible={false}>
                <textarea
                  value={noteDraft}
                  disabled={!canEdit || draft.stage === "dqed"}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={4}
                  placeholder="Add a note…"
                  style={{ ...fieldStyle, marginBottom: 10, fontWeight: 500, opacity: !canEdit || draft.stage === "dqed" ? 0.65 : 1, resize: "vertical", minHeight: 100 }}
                  onFocus={fieldFocus}
                  onBlur={fieldBlur}
                />
                <button
                  type="button"
                  disabled={!canEdit || saving || draft.stage === "dqed"}
                  onClick={() => void addNote()}
                  style={{ height: 34, padding: "0 14px", borderRadius: 10, border: "none", background: BRAND_GREEN, color: "#fff", fontSize: 12, fontWeight: 900, fontFamily: T.font, cursor: !canEdit || saving || draft.stage === "dqed" ? "not-allowed" : "pointer", opacity: !canEdit || saving || draft.stage === "dqed" ? 0.6 : 1 }}
                >
                  Save note
                </button>
                <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                  {notes.map((n) => (
                    <div key={n.id} style={{ borderRadius: 12, border: `1px solid ${T.border}`, padding: "12px 14px", fontSize: 13, backgroundColor: T.blueFaint, fontFamily: T.font }}>
                      <div style={{ marginBottom: 6, fontSize: 11, fontWeight: 900, color: T.textMuted }}>
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                      <div style={{ whiteSpace: "pre-wrap", color: T.textDark, lineHeight: 1.5 }}>{n.body}</div>
                    </div>
                  ))}
                </div>
                </LeadCard>
              </div>
            )}
        </div>
      )}

      {!canEdit && (
        <div style={{ marginTop: 12, fontSize: 12, color: T.textMuted, fontWeight: 700 }}>
          Read-only view.
        </div>
      )}
    </div>
  );
}

