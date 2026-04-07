"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { T } from "@/lib/theme";
import { Card } from "@/components/ui/card";
import { Table as ShadcnTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/shadcn/table";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Search, Filter, Plus, Eye, Edit2, Trash2 } from "lucide-react";
import UserEditorComponent from "./UserEditorComponent";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserLink {
  id: string;
  name: string;
  roleKey: string | null;
  callCenterId: string | null;
}

interface CenterRow {
  id: string;
  name: string;
  createdAt: string;
  did: string | null;
  slack_channel: string | null;
  email: string | null;
  logo_url: string | null;
  admin: UserLink | null;
  agentCount: number;
}

interface CenterDetail extends CenterRow {
  agents: UserLink[];
}

interface CenterThreshold {
  id: string;
  centerName: string;
  leadVendor: string;
  tier: 'A' | 'B' | 'C';
  dailyTransferTarget: number;
  dailySalesTarget: number;
  maxDqPercentage: number;
  minApprovalRatio: number;
  transferWeight: number;
  approvalRatioWeight: number;
  dqWeight: number;
  isActive: boolean;
  slackWebhookUrl: string | null;
  slackChannel: string | null;
  slackManagerId: string | null;
  slackChannelId: string | null;
  underwritingThreshold: number;
  createdAt: string;
  updatedAt: string;
}

function centreNameInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const firstWord = (trimmed.split(/[\s\-–—]+/)[0] ?? trimmed).replace(/[^a-zA-Z0-9]/g, "");
  if (firstWord.length > 0) {
    return firstWord.slice(0, 3).toUpperCase();
  }
  return trimmed.charAt(0).toUpperCase();
}

function StyledSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select..."
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
          height: 38,
          borderRadius: 10,
          border: `1px solid ${T.border}`,
          backgroundColor: T.cardBg,
          color: value && value !== "All" ? T.textDark : T.textMuted,
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
          {value && value !== "All"
            ? options.find(o => o.value === value)?.label || value
            : placeholder}
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

function LoadingSpinner({ size = 40, label = "Loading..." }: { size?: number; label?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
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
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function StatSkeleton() {
  return (
    <Card
      style={{
        borderRadius: 16,
        border: `1px solid ${T.border}`,
        borderBottom: "4px solid #DCEBDC",
        background: T.cardBg,
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
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, flex: 1 }}>
        <div style={{ width: 80, height: 10, borderRadius: 4, background: "linear-gradient(90deg, #E8E8E8 25%, #F0F0F0 50%, #E8E8E8 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
        <div style={{ width: 60, height: 26, borderRadius: 6, background: "linear-gradient(90deg, #E8E8E8 25%, #F0F0F0 50%, #E8E8E8 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
      </div>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "linear-gradient(90deg, #E8E8E8 25%, #F0F0F0 50%, #E8E8E8 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
        }}
      />
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </Card>
  );
}

export default function BpoCentersPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [centers, setCenters] = useState<CenterRow[]>([]);
  const [users, setUsers] = useState<UserLink[]>([]);
  const [roleIds, setRoleIds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [newCenterName, setNewCenterName] = useState("");
  const [page, setPage] = useState(1);
  const [selectedCenter, setSelectedCenter] = useState<CenterDetail | null>(null);
  const [editingCenterName, setEditingCenterName] = useState("");
  const [view, setView] = useState<"list" | "edit">("list");
  const [selectedAdminUserId, setSelectedAdminUserId] = useState("");
  const [selectedAgentUserId, setSelectedAgentUserId] = useState("");
  const [filterAdmin, setFilterAdmin] = useState<"All" | "Assigned" | "Unassigned">("All");
  const itemsPerPage = 10;
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [touchedFields, setTouchedFields] = useState({
    name: false,
    did: false,
    slack_channel: false,
    email: false,
  });
  
  const [activeTab, setActiveTab] = useState<"info" | "thresholds" | "team">("info");
  const [thresholdData, setThresholdData] = useState<CenterThreshold | null>(null);
  const [thresholdLoading, setThresholdLoading] = useState(false);
  const [thresholdSaving, setThresholdSaving] = useState(false);

  const [filterPanelExpanded, setFilterPanelExpanded] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCenter, setDeletingCenter] = useState<CenterRow | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deletingInProgress, setDeletingInProgress] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivatingCenter, setDeactivatingCenter] = useState<CenterRow | null>(null);
  const [deactivateConfirmName, setDeactivateConfirmName] = useState("");
  const [deactivatingInProgress, setDeactivatingInProgress] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingCenter, setCreatingCenter] = useState(false);
  const [hoveredStatIdx, setHoveredStatIdx] = useState<number | null>(null);

  const isMissingRequired = (value: string | null | undefined) => String(value ?? "").trim() === "";

  const requiredFieldLabels = () => {
    const missing: string[] = [];
    if (isMissingRequired(editingCenterName)) missing.push("Centre Name");
    if (isMissingRequired(selectedCenter?.did)) missing.push("Direct Line (DID)");
    if (isMissingRequired(selectedCenter?.slack_channel)) missing.push("Slack Channel");
    if (isMissingRequired(selectedCenter?.email)) missing.push("Email");
    return missing;
  };

  const hasActiveFilters = filterAdmin !== "All";
  const activeFilterCount = filterAdmin !== "All" ? 1 : 0;

  const clearFilters = () => {
    setFilterAdmin("All");
    setPage(1);
  };

  function buildCenterDetail(centerId: string, sourceCenters = centers, sourceUsers = users): CenterDetail | null {
    const center = sourceCenters.find((item) => item.id === centerId);
    if (!center) return null;

    return {
      ...center,
      agents: sourceUsers.filter(
        (user) => user.callCenterId === centerId && user.roleKey === "call_center_agent",
      ),
    };
  }

  async function fetchDirectory() {
    const [{ data: rolesData, error: rolesError }, { data: centersData, error: centersError }, { data: usersData, error: usersError }] = await Promise.all([
      supabase.from("roles").select("id, key"),
      supabase.from("call_centers").select("id, name, created_at, did, slack_channel, email, logo_url").order("name"),
      supabase.from("users").select("id, full_name, call_center_id, role_id"),
    ]);

    if (rolesError) {
      console.error("Error fetching roles:", rolesError);
    }
    if (centersError) {
      console.error("Error fetching centers:", centersError);
    }
    if (usersError) {
      console.error("Error fetching call center users:", usersError);
    }

    const roleIdMap = Object.fromEntries((rolesData ?? []).map((role) => [role.key, role.id]));
    const roleKeyById = Object.fromEntries((rolesData ?? []).map((role) => [role.id, role.key]));
    const normalizedUsers: UserLink[] = (usersData ?? []).map((user) => ({
      id: user.id,
      name: user.full_name?.trim() || `User ${user.id.slice(0, 8)}`,
      roleKey: user.role_id ? roleKeyById[user.role_id] ?? null : null,
      callCenterId: user.call_center_id,
    }));

    const centerRows: CenterRow[] = (centersData ?? []).map((center) => {
      const admin = normalizedUsers.find(
        (user) => user.callCenterId === center.id && user.roleKey === "call_center_admin",
      ) ?? null;
      const agents = normalizedUsers.filter(
        (user) => user.callCenterId === center.id && user.roleKey === "call_center_agent",
      );

      return {
        id: center.id,
        name: center.name,
        createdAt: new Date(center.created_at).toLocaleString(),
        did: center.did ?? null,
        slack_channel: center.slack_channel ?? null,
        email: center.email ?? null,
        logo_url: center.logo_url ?? null,
        admin,
        agentCount: agents.length,
      };
    });

    setRoleIds(roleIdMap);
    setUsers(normalizedUsers);
    setCenters(centerRows);

    if (selectedCenter && view === "edit" && selectedCenter.id !== 'new') {
      const refreshed = buildCenterDetail(selectedCenter.id, centerRows, normalizedUsers);
      setSelectedCenter(refreshed);
      setEditingCenterName(refreshed?.name ?? "");
      setLogoUrl(refreshed?.logo_url ?? null);
      void fetchThresholdData(refreshed?.name ?? "");
    }

    setLoading(false);
  }

  async function fetchThresholdData(centerName: string) {
    if (!centerName) {
      setThresholdData(null);
      return;
    }
    
    setThresholdLoading(true);
    try {
      const { data, error } = await supabase
        .from("center_thresholds")
        .select("*")
        .eq("center_name", centerName)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching threshold data:", error);
      }

      if (data) {
        setThresholdData({
          id: data.id,
          centerName: data.center_name,
          leadVendor: data.lead_vendor,
          tier: data.tier || 'C',
          dailyTransferTarget: data.daily_transfer_target || 10,
          dailySalesTarget: data.daily_sales_target || 5,
          maxDqPercentage: data.max_dq_percentage || 20,
          minApprovalRatio: data.min_approval_ratio || 20,
          transferWeight: data.transfer_weight || 40,
          approvalRatioWeight: data.approval_ratio_weight || 35,
          dqWeight: data.dq_weight || 25,
          isActive: data.is_active ?? true,
          slackWebhookUrl: data.slack_webhook_url,
          slackChannel: data.slack_channel,
          slackManagerId: data.slack_manager_id,
          slackChannelId: data.slack_channel_id,
          underwritingThreshold: data.underwriting_threshold || 5,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        });
      } else {
        setThresholdData({
          id: "",
          centerName: centerName,
          leadVendor: "",
          tier: 'C',
          dailyTransferTarget: 10,
          dailySalesTarget: 5,
          maxDqPercentage: 20,
          minApprovalRatio: 20,
          transferWeight: 40,
          approvalRatioWeight: 35,
          dqWeight: 25,
          isActive: true,
          slackWebhookUrl: null,
          slackChannel: null,
          slackManagerId: null,
          slackChannelId: null,
          underwritingThreshold: 5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error in fetchThresholdData:", error);
    } finally {
      setThresholdLoading(false);
    }
  }

  async function saveThresholdData() {
    if (!thresholdData || !selectedCenter) return;

    setThresholdSaving(true);
    try {
      const payload = {
        center_name: thresholdData.centerName,
        lead_vendor: thresholdData.leadVendor,
        tier: thresholdData.tier,
        daily_transfer_target: thresholdData.dailyTransferTarget,
        daily_sales_target: thresholdData.dailySalesTarget,
        max_dq_percentage: thresholdData.maxDqPercentage,
        min_approval_ratio: thresholdData.minApprovalRatio,
        transfer_weight: thresholdData.transferWeight,
        approval_ratio_weight: thresholdData.approvalRatioWeight,
        dq_weight: thresholdData.dqWeight,
        is_active: thresholdData.isActive,
        slack_webhook_url: thresholdData.slackWebhookUrl,
        slack_channel: thresholdData.slackChannel,
        slack_manager_id: thresholdData.slackManagerId,
        slack_channel_id: thresholdData.slackChannelId,
        underwriting_threshold: thresholdData.underwritingThreshold,
      };

      if (thresholdData.id) {
        const { error } = await supabase
          .from("center_thresholds")
          .update(payload)
          .eq("id", thresholdData.id);

        if (error) throw error;
        setToast({ message: "Threshold settings saved successfully.", type: "success" });
      } else {
        const { data, error } = await supabase
          .from("center_thresholds")
          .insert([payload])
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setThresholdData(prev => prev ? { ...prev, id: data.id } : null);
        }
        setToast({ message: "Threshold settings created successfully.", type: "success" });
      }
    } catch (error: any) {
      console.error("Error saving threshold data:", error);
      setToast({ message: `Failed to save threshold settings: ${error?.message || "Unknown error"}`, type: "error" });
    } finally {
      setThresholdSaving(false);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [search, filterAdmin]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchDirectory();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function handleOpenCreate() {
    setSelectedCenter({
      id: "new",
      name: "",
      createdAt: "",
      did: "",
      slack_channel: "",
      email: "",
      logo_url: null,
      admin: null,
      agentCount: 0,
      agents: []
    } as any);
    setEditingCenterName("");
    setLogoUrl(null);
    setSaveAttempted(false);
    setTouchedFields({ name: false, did: false, slack_channel: false, email: false });
    setActiveTab("info");
    setThresholdData(null);
    setView("edit");
  }

  async function handleCreateCenter() {
    setSaveAttempted(true);
    const missing = requiredFieldLabels();
    if (missing.length > 0) {
      setToast({ message: `Please fill required fields: ${missing.join(", ")}.`, type: "error" });
      return;
    }
    const trimmed = editingCenterName.trim();
    if (!trimmed) return;

    const { data, error } = await supabase.from("call_centers").insert([{
      name: trimmed,
      did: selectedCenter?.did?.trim() || null,
      slack_channel: selectedCenter?.slack_channel?.trim() || null,
      email: selectedCenter?.email?.trim() || null,
      logo_url: logoUrl || selectedCenter?.logo_url || null,
    }]).select("id, name, created_at, did, slack_channel, email, logo_url").single();
    if (error) {
      console.error("Error creating center:", error);
      setToast({ message: `Failed to create centre: ${error.message}`, type: "error" });
      return;
    }

    setToast({
      message: "Centre created successfully.",
      type: "success",
    });
    if (data?.id) {
      const createdCenter: CenterDetail = {
        id: data.id,
        name: data.name,
        createdAt: data.created_at ? new Date(data.created_at).toLocaleString() : new Date().toLocaleString(),
        did: data.did ?? null,
        slack_channel: data.slack_channel ?? null,
        email: data.email ?? null,
        logo_url: data.logo_url ?? null,
        admin: null,
        agentCount: 0,
        agents: [],
      };
      setSelectedCenter(createdCenter);
      setEditingCenterName(createdCenter.name);
      setLogoUrl(createdCenter.logo_url);
      setActiveTab("team");
      setView("edit");
    } else {
      setEditingCenterName("");
      setLogoUrl(null);
      setSelectedCenter(null);
      setView("list");
    }
    await fetchDirectory();
  }

  async function handleDeleteCenter() {
    if (!deletingCenter) return;
    if (deleteConfirmName !== deletingCenter.name) return;

    setDeletingInProgress(true);

    const linkedUsers = users.filter((user) => user.callCenterId === deletingCenter.id);
    if (linkedUsers.length > 0) {
      const { error: unlinkError } = await supabase
        .from("users")
        .update({ call_center_id: null })
        .eq("call_center_id", deletingCenter.id);

      if (unlinkError) {
        console.error("Error unlinking center users:", unlinkError);
        setDeletingInProgress(false);
        return;
      }
    }

    const { error } = await supabase.from("call_centers").delete().eq("id", deletingCenter.id);
    if (error) {
      console.error("Error deleting center:", error);
      setDeletingInProgress(false);
      return;
    }

    setShowDeleteModal(false);
    setDeletingCenter(null);
    setDeleteConfirmName("");
    setDeletingInProgress(false);
    await fetchDirectory();
  }

  async function handleRenameCenter() {
    if (!selectedCenter || !editingCenterName.trim()) return;
    setSaveAttempted(true);
    const missing = requiredFieldLabels();
    if (missing.length > 0) {
      setToast({ message: `Please fill required fields: ${missing.join(", ")}.`, type: "error" });
      return;
    }

    const { error } = await supabase
      .from("call_centers")
      .update({
        name: editingCenterName.trim(),
        did: selectedCenter.did?.trim() || null,
        slack_channel: selectedCenter.slack_channel?.trim() || null,
        email: selectedCenter.email?.trim() || null,
        logo_url: logoUrl || selectedCenter.logo_url || null,
      })
      .eq("id", selectedCenter.id);

    if (error) {
      console.error("Error updating center:", error);
      setToast({ message: `Failed to save centre changes: ${error.message}`, type: "error" });
      return;
    }

    setToast({
      message: "Centre updated successfully.",
      type: "success",
    });
    await fetchDirectory();
  }

  async function handleAssignAdmin() {
    if (!selectedCenter || !selectedAdminUserId || !roleIds.call_center_admin) return;

    const operations = [];
    if (selectedCenter.admin && selectedCenter.admin.id !== selectedAdminUserId) {
      operations.push(
        supabase
          .from("users")
          .update({ call_center_id: null })
          .eq("id", selectedCenter.admin.id),
      );
    }

    operations.push(
      supabase
        .from("users")
        .update({
          role_id: roleIds.call_center_admin,
          call_center_id: selectedCenter.id,
        })
        .eq("id", selectedAdminUserId),
    );

    const results = await Promise.all(operations);
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      console.error("Error assigning center admin:", failed.error);
      return;
    }

    setSelectedAdminUserId("");
    await fetchDirectory();
  }

  async function handleRemoveAdmin() {
    if (!selectedCenter?.admin) return;

    const { error } = await supabase
      .from("users")
      .update({ call_center_id: null })
      .eq("id", selectedCenter.admin.id);

    if (error) {
      console.error("Error removing center admin:", error);
      return;
    }

    await fetchDirectory();
  }

  async function handleAddAgent() {
    if (!selectedCenter || !selectedAgentUserId || !roleIds.call_center_agent) return;

    const { error } = await supabase
      .from("users")
      .update({
        role_id: roleIds.call_center_agent,
        call_center_id: selectedCenter.id,
      })
      .eq("id", selectedAgentUserId);

    if (error) {
      console.error("Error adding center agent:", error);
      return;
    }

    setSelectedAgentUserId("");
    await fetchDirectory();
  }

  async function handleRemoveAgent(userId: string) {
    const { error } = await supabase
      .from("users")
      .update({ call_center_id: null })
      .eq("id", userId);

    if (error) {
      console.error("Error removing center agent:", error);
      return;
    }

    await fetchDirectory();
  }

  async function deactivateCenterById(centerId: string, centerName: string) {
    const baseName = centerName.replace(/^Inactive:/i, "").trim();
    const inactiveName = `Inactive:${baseName}`;

    const { error: usersError } = await supabase
      .from("users")
      .update({
        status: "inactive",
      })
      .eq("call_center_id", centerId);

    if (usersError) {
      console.error("Error deactivating center users:", usersError);
      setToast({ message: `Failed to deactivate centre users: ${usersError.message}`, type: "error" });
      return false;
    }

    const { error: centerError } = await supabase
      .from("call_centers")
      .update({
        name: inactiveName,
        status: "inactive",
      })
      .eq("id", centerId);

    if (centerError) {
      const { error: fallbackCenterError } = await supabase
        .from("call_centers")
        .update({
          name: inactiveName,
        })
        .eq("id", centerId);

      if (fallbackCenterError) {
        console.error("Error deactivating center:", fallbackCenterError);
        setToast({ message: `Failed to deactivate centre: ${fallbackCenterError.message}`, type: "error" });
        return false;
      }
    }

    setToast({ message: "Centre marked inactive and linked users were deactivated.", type: "success" });
    await fetchDirectory();
    return true;
  }

  async function handleDeactivateCenter() {
    if (!selectedCenter || selectedCenter.id === "new") return;
    setDeactivatingCenter(selectedCenter);
    setDeactivateConfirmName("");
    setShowDeactivateModal(true);
  }

  async function handleDeactivateCenterFromRow(center: CenterRow) {
    setDeactivatingCenter(center);
    setDeactivateConfirmName("");
    setShowDeactivateModal(true);
  }

  async function handleDeactivateCenterConfirm() {
    if (!deactivatingCenter) return;
    if (deactivateConfirmName !== deactivatingCenter.name) return;
    setDeactivatingInProgress(true);
    const ok = await deactivateCenterById(deactivatingCenter.id, deactivatingCenter.name);
    setDeactivatingInProgress(false);
    if (!ok) return;
    setShowDeactivateModal(false);
    setDeactivatingCenter(null);
    setDeactivateConfirmName("");
  }

  async function reactivateCenterById(centerId: string, centerName: string) {
    const activeName = centerName.replace(/^Inactive:/i, "").trim() || centerName;
    const { error: centerError } = await supabase
      .from("call_centers")
      .update({
        name: activeName,
        status: "active",
      })
      .eq("id", centerId);

    if (centerError) {
      const { error: fallbackCenterError } = await supabase
        .from("call_centers")
        .update({
          name: activeName,
        })
        .eq("id", centerId);
      if (fallbackCenterError) {
        setToast({ message: `Failed to reactivate centre: ${fallbackCenterError.message}`, type: "error" });
        return;
      }
    }

    setToast({ message: "Centre reactivated successfully.", type: "success" });
    await fetchDirectory();
  }

  async function handleReactivateCenterFromRow(center: CenterRow) {
    await reactivateCenterById(center.id, center.name);
  }


  const adminOptions = users
    .filter((user) => user.id !== selectedCenter?.admin?.id)
    .map((user) => ({
      value: user.id,
      label: `${user.name} (${user.id.slice(0, 8)})`,
    }));

  const agentOptions = users
    .filter((user) => user.callCenterId !== selectedCenter?.id || user.roleKey !== "call_center_agent")
    .filter((user) => user.id !== selectedCenter?.admin?.id)
    .map((user) => ({
      value: user.id,
      label: `${user.name} (${user.id.slice(0, 8)})`,
    }));

  const filteredCenters = centers.filter((center) => {
    const matchesSearch = center.name.toLowerCase().includes(search.toLowerCase());
    const matchesAdmin = filterAdmin === "All" ? true : filterAdmin === "Assigned" ? !!center.admin : !center.admin;
    return matchesSearch && matchesAdmin;
  });
  const totalPages = Math.max(1, Math.ceil(filteredCenters.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginatedCenters = filteredCenters.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  function openEditModal(center: CenterRow) {
    const detail = buildCenterDetail(center.id);
    if (detail) {
      setSelectedCenter(detail);
      setEditingCenterName(detail.name);
      setLogoUrl(detail.logo_url ?? null);
      setActiveTab("info");
      void fetchThresholdData(detail.name);
      setView("edit");
    }
  }

  function openDeleteModal(center: CenterRow) {
    setDeletingCenter(center);
    setDeleteConfirmName("");
    setShowDeleteModal(true);
  }

  if (view === "edit" && selectedCenter) {
    const isNew = selectedCenter.id === 'new';
    const showInvalid = saveAttempted;
    const invalidName = (showInvalid || touchedFields.name) && isMissingRequired(editingCenterName);
    const invalidDid = (showInvalid || touchedFields.did) && isMissingRequired(selectedCenter.did);
    const invalidSlack = (showInvalid || touchedFields.slack_channel) && isMissingRequired(selectedCenter.slack_channel);
    const invalidEmail = (showInvalid || touchedFields.email) && isMissingRequired(selectedCenter.email);

    const requiredInputStyle = (invalid: boolean) => ({
      width: "100%",
      padding: "14px 18px",
      border: `1.5px solid ${invalid ? T.danger : T.border}`,
      borderRadius: 12,
      fontSize: 15,
      fontWeight: 600,
      outline: "none",
      backgroundColor: T.rowBg + "44",
      transition: "all 0.2s",
      boxShadow: invalid ? "0 0 0 3px rgba(239,68,68,0.12)" : undefined,
    });

    return (
      <div style={{ padding: "0", animation: "fadeIn 0.4s ease-out" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <button 
              onClick={() => setView("list")} 
              style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 12, color: T.textDark, cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.textMuted, display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                BPO Management <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 18l6-6-6-6"/></svg> <span style={{ color: T.blue }}>{isNew ? "New Centre" : "Edit Centre"}</span>
              </div>
              <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
                {isNew ? "BPO Centre Onboarding" : "Centre Configuration"}
              </h1>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
          </div>
        </div>

        <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
          
          <div style={{ width: 320, backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 24, padding: 32, textAlign: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.03)" }}>
            <div style={{ position: "relative", width: 100, height: 100, margin: "0 auto 20px" }}>
              <div style={{ width: "100%", height: "100%", borderRadius: "50%", backgroundColor: T.blue, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, overflow: "hidden", letterSpacing: "0.02em" }}>
                {logoUrl || selectedCenter?.logo_url ? (
                  <img src={logoUrl || selectedCenter?.logo_url || ""} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  centreNameInitials(editingCenterName)
                )}
                {logoUploading && (
                  <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700 }}>Uploading...</div>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={async e => {
                  const file = e.target.files?.[0] || null;
                  if (!file) return;
                  setLogoUploading(true);
                  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                  const uniqueName = `${Date.now()}_${crypto.randomUUID()}_${safeName}`;
                  const { data, error } = await supabase.storage
                    .from('bpo-logos')
                    .upload(`logos/${uniqueName}`, file, { upsert: false });
                  if (data) {
                    const { data: publicUrlData } = supabase.storage
                      .from('bpo-logos')
                      .getPublicUrl(data.path);
                    const publicUrl = publicUrlData.publicUrl;
                    setLogoUrl(publicUrl);
                    setSelectedCenter(prev => prev ? { ...prev, logo_url: publicUrl } : prev);
                    if (selectedCenter?.id && selectedCenter.id !== "new") {
                      const { error: logoPersistError } = await supabase
                        .from("call_centers")
                        .update({ logo_url: publicUrl })
                        .eq("id", selectedCenter.id);
                      if (logoPersistError) {
                        setToast({ message: "Logo uploaded but failed to save to centre: " + logoPersistError.message, type: "error" });
                      }
                    }
                  } else if (error) {
                    setToast({ message: "Logo upload failed: " + error.message, type: "error" });
                  }
                  setLogoUploading(false);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ position: "absolute", bottom: 0, right: 0, width: 32, height: 32, backgroundColor: "#fff", borderRadius: "50%", border: `1.5px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", cursor: "pointer", padding: 0 }}
                title="Upload Logo"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </button>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 8px", color: T.textDark }}>{editingCenterName || "Unnamed Centre"}</h3>
          </div>

          <div style={{ flex: 1, backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 24, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.03)" }}>
            
            <div style={{ display: "flex", borderBottom: `1.5px solid ${T.border}`, padding: "0 20px" }}>
              {[
                { id: "info", label: "Centre Info" },
                { id: "thresholds", label: "Threshold Settings" },
                { id: "team", label: "Team Setup" },
              ].map((tab) => {
                const isThresholdsTab = tab.id === "thresholds";
                const isNew = selectedCenter?.id === 'new';
                const isDisabled = (isThresholdsTab || tab.id === "team") && isNew;
                
                return (
                  <div 
                    key={tab.id} 
                    onClick={() => !isDisabled && setActiveTab(tab.id as "info" | "thresholds" | "team")}
                    style={{ 
                      padding: "20px 24px", 
                      fontSize: 14, 
                      fontWeight: 800, 
                      color: isDisabled ? T.border : (activeTab === tab.id ? T.blue : T.textMuted), 
                      position: "relative", 
                      cursor: isDisabled ? "not-allowed" : "pointer",
                      transition: "color 0.2s",
                      opacity: isDisabled ? 0.5 : 1,
                    }}
                    title={isDisabled ? "Save the center first to configure thresholds" : tab.label}
                  >
                    {tab.label}
                    {activeTab === tab.id && !isDisabled && (
                      <div style={{ position: "absolute", bottom: -1.5, left: 0, right: 0, height: 3, backgroundColor: T.blue, borderRadius: "3px 3px 0 0" }} />
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ padding: 40 }}>
              {activeTab === "info" ? (
                <>
                  <div style={{ marginBottom: 40 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>CENTRE NAME *</label>
                        <input 
                          autoFocus
                          value={editingCenterName}
                          onChange={(e) => setEditingCenterName(e.target.value)}
                          onBlur={() => setTouchedFields((prev) => ({ ...prev, name: true }))}
                          placeholder="e.g. Islamabad North Hub"
                          style={requiredInputStyle(invalidName)}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>DIRECT LINE (DID) *</label>
                        <input 
                          type="tel"
                          value={selectedCenter.did || ""}
                          onChange={e => setSelectedCenter({ ...selectedCenter, did: e.target.value.replace(/[^0-9+]/g, "") })}
                          onBlur={() => setTouchedFields((prev) => ({ ...prev, did: true }))}
                          placeholder="e.g. +15550000000"
                          style={requiredInputStyle(invalidDid)}
                        />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>SLACK CHANNEL *</label>
                        <input 
                          value={selectedCenter.slack_channel || ""}
                          onChange={e => setSelectedCenter({ ...selectedCenter, slack_channel: e.target.value })}
                          onBlur={() => setTouchedFields((prev) => ({ ...prev, slack_channel: true }))}
                          placeholder="#bpo-centre-slack"
                          style={requiredInputStyle(invalidSlack)}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>EMAIL *</label>
                        <input 
                          type="email"
                          value={selectedCenter.email || ""}
                          onChange={e => setSelectedCenter({ ...selectedCenter, email: e.target.value })}
                          onBlur={() => setTouchedFields((prev) => ({ ...prev, email: true }))}
                          placeholder="centre@email.com"
                          style={requiredInputStyle(invalidEmail)}
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end" }}>
                      {!isNew && (
                        <button
                          onClick={handleDeactivateCenter}
                          style={{
                            marginRight: "auto",
                            padding: "12px 20px",
                            borderRadius: 10,
                            border: "none",
                            backgroundColor: "#991b1b",
                            color: "#fff",
                            fontSize: 14,
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          Mark Centre Inactive
                        </button>
                      )}
                      <button 
                        onClick={() => setView("list")}
                        style={{ marginRight: 16, padding: "12px 32px", borderRadius: 10, border: `1.5px solid ${T.border}`, backgroundColor: "#fff", color: T.textDark, fontSize: 14, fontWeight: 800, cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={isNew ? handleCreateCenter : handleRenameCenter}
                        style={{ padding: "12px 32px", borderRadius: 10, border: "none", backgroundColor: T.blue, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 12px rgba(0,102,255,0.25)" }}
                      >
                        {isNew ? "Create Centre" : "Save Changes"}
                      </button>
                    </div>
                  </div>
                </>
              ) : activeTab === "thresholds" ? (
                <>
                  {thresholdLoading ? (
                    <div style={{ padding: 60, textAlign: "center", color: T.textMuted }}>
                      Loading threshold settings...
                    </div>
                  ) : thresholdData ? (
                    <>
                      <div style={{ marginBottom: 40 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: T.textDark, marginBottom: 20, paddingBottom: 12, borderBottom: `1.5px solid ${T.border}` }}>
                          Basic Information
                        </h3>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, marginBottom: 24 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>CENTER NAME</label>
                            <input 
                              value={thresholdData.centerName}
                              disabled
                              style={{ 
                                width: "100%", 
                                padding: "14px 18px", 
                                border: `1.5px solid ${T.border}`, 
                                borderRadius: 12, 
                                fontSize: 15, 
                                fontWeight: 600,
                                backgroundColor: T.rowBg,
                                color: T.textMid,
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>LEAD VENDOR *</label>
                            <input 
                              value={thresholdData.leadVendor}
                              onChange={e => setThresholdData({ ...thresholdData, leadVendor: e.target.value })}
                              placeholder="e.g. Vendor ABC"
                              style={{ 
                                width: "100%", 
                                padding: "14px 18px", 
                                border: `1.5px solid ${T.border}`, 
                                borderRadius: 12, 
                                fontSize: 15, 
                                fontWeight: 600,
                                outline: "none",
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>TIER</label>
                            <select
                              value={thresholdData.tier}
                              onChange={e => setThresholdData({ ...thresholdData, tier: e.target.value as 'A' | 'B' | 'C' })}
                              style={{ 
                                width: "100%", 
                                padding: "14px 18px", 
                                border: `1.5px solid ${T.border}`, 
                                borderRadius: 12, 
                                fontSize: 15, 
                                fontWeight: 600,
                                backgroundColor: "#fff",
                                cursor: "pointer",
                              }}
                            >
                              <option value="A">Tier A (Elite)</option>
                              <option value="B">Tier B (Premium)</option>
                              <option value="C">Tier C (Standard)</option>
                            </select>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={thresholdData.isActive}
                              onChange={e => setThresholdData({ ...thresholdData, isActive: e.target.checked })}
                              style={{ width: 18, height: 18, cursor: "pointer" }}
                            />
                            <span style={{ fontSize: 14, fontWeight: 700, color: T.textDark }}>Center is Active</span>
                          </label>
                        </div>
                      </div>

                      <div style={{ marginBottom: 40 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: T.textDark, marginBottom: 20, paddingBottom: 12, borderBottom: `1.5px solid ${T.border}` }}>
                          Daily Targets
                        </h3>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>DAILY TRANSFER TARGET</label>
                            <input 
                              type="number"
                              min={0}
                              value={thresholdData.dailyTransferTarget}
                              onChange={e => setThresholdData({ ...thresholdData, dailyTransferTarget: parseInt(e.target.value) || 0 })}
                              style={{ 
                                width: "100%", 
                                padding: "14px 18px", 
                                border: `1.5px solid ${T.border}`, 
                                borderRadius: 12, 
                                fontSize: 15, 
                                fontWeight: 600,
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>DAILY SALES TARGET</label>
                            <input 
                              type="number"
                              min={0}
                              value={thresholdData.dailySalesTarget}
                              onChange={e => setThresholdData({ ...thresholdData, dailySalesTarget: parseInt(e.target.value) || 0 })}
                              style={{ 
                                width: "100%", 
                                padding: "14px 18px", 
                                border: `1.5px solid ${T.border}`, 
                                borderRadius: 12, 
                                fontSize: 15, 
                                fontWeight: 600,
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>UNDERWRITING THRESHOLD</label>
                            <input 
                              type="number"
                              min={0}
                              value={thresholdData.underwritingThreshold}
                              onChange={e => setThresholdData({ ...thresholdData, underwritingThreshold: parseInt(e.target.value) || 0 })}
                              style={{ 
                                width: "100%", 
                                padding: "14px 18px", 
                                border: `1.5px solid ${T.border}`, 
                                borderRadius: 12, 
                                fontSize: 15, 
                                fontWeight: 600,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div style={{ marginBottom: 40 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: T.textDark, marginBottom: 20, paddingBottom: 12, borderBottom: `1.5px solid ${T.border}` }}>
                          Performance Thresholds (%)
                        </h3>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>MAX DQ PERCENTAGE</label>
                            <input 
                              type="number"
                              min={0}
                              max={100}
                              step={0.01}
                              value={thresholdData.maxDqPercentage}
                              onChange={e => setThresholdData({ ...thresholdData, maxDqPercentage: parseFloat(e.target.value) || 0 })}
                              style={{ 
                                width: "100%", 
                                padding: "14px 18px", 
                                border: `1.5px solid ${T.border}`, 
                                borderRadius: 12, 
                                fontSize: 15, 
                                fontWeight: 600,
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>MIN APPROVAL RATIO</label>
                            <input 
                              type="number"
                              min={0}
                              max={100}
                              step={0.01}
                              value={thresholdData.minApprovalRatio}
                              onChange={e => setThresholdData({ ...thresholdData, minApprovalRatio: parseFloat(e.target.value) || 0 })}
                              style={{ 
                                width: "100%", 
                                padding: "14px 18px", 
                                border: `1.5px solid ${T.border}`, 
                                borderRadius: 12, 
                                fontSize: 15, 
                                fontWeight: 600,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div style={{ marginBottom: 40 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: T.textDark, marginBottom: 20, paddingBottom: 12, borderBottom: `1.5px solid ${T.border}` }}>
                          Performance Weights (must total 100)
                        </h3>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>TRANSFER WEIGHT</label>
                            <input 
                              type="number"
                              min={0}
                              max={100}
                              value={thresholdData.transferWeight}
                              onChange={e => setThresholdData({ ...thresholdData, transferWeight: parseInt(e.target.value) || 0 })}
                              style={{ 
                                width: "100%", 
                                padding: "14px 18px", 
                                border: `1.5px solid ${T.border}`, 
                                borderRadius: 12, 
                                fontSize: 15, 
                                fontWeight: 600,
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>APPROVAL RATIO WEIGHT</label>
                            <input 
                              type="number"
                              min={0}
                              max={100}
                              value={thresholdData.approvalRatioWeight}
                              onChange={e => setThresholdData({ ...thresholdData, approvalRatioWeight: parseInt(e.target.value) || 0 })}
                              style={{ 
                                width: "100%", 
                                padding: "14px 18px", 
                                border: `1.5px solid ${T.border}`, 
                                borderRadius: 12, 
                                fontSize: 15, 
                                fontWeight: 600,
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>DQ WEIGHT</label>
                            <input 
                              type="number"
                              min={0}
                              max={100}
                              value={thresholdData.dqWeight}
                              onChange={e => setThresholdData({ ...thresholdData, dqWeight: parseInt(e.target.value) || 0 })}
                              style={{ 
                                width: "100%", 
                                padding: "14px 18px", 
                                border: `1.5px solid ${T.border}`, 
                                borderRadius: 12, 
                                fontSize: 15, 
                                fontWeight: 600,
                              }}
                            />
                          </div>
                        </div>
                        <div style={{ marginTop: 12, padding: 12, backgroundColor: T.rowBg, borderRadius: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.textMid }}>
                            Total: {thresholdData.transferWeight + thresholdData.approvalRatioWeight + thresholdData.dqWeight}%
                            {thresholdData.transferWeight + thresholdData.approvalRatioWeight + thresholdData.dqWeight !== 100 && (
                              <span style={{ color: T.danger, marginLeft: 8 }}>(Should equal 100%)</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ marginBottom: 40 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: T.textDark, marginBottom: 20, paddingBottom: 12, borderBottom: `1.5px solid ${T.border}` }}>
                          Slack Integration
                        </h3>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>WEBHOOK URL</label>
                            <input 
                              value={thresholdData.slackWebhookUrl || ""}
                              onChange={e => setThresholdData({ ...thresholdData, slackWebhookUrl: e.target.value })}
                              placeholder="https://hooks.slack.com/services/..."
                              style={{ 
                                width: "100%", 
                                padding: "14px 18px", 
                                border: `1.5px solid ${T.border}`, 
                                borderRadius: 12, 
                                fontSize: 15, 
                                fontWeight: 600,
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>CHANNEL</label>
                            <input 
                              value={thresholdData.slackChannel || ""}
                              onChange={e => setThresholdData({ ...thresholdData, slackChannel: e.target.value })}
                              placeholder="#alerts"
                              style={{ 
                                width: "100%", 
                                padding: "14px 18px", 
                                border: `1.5px solid ${T.border}`, 
                                borderRadius: 12, 
                                fontSize: 15, 
                                fontWeight: 600,
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>CHANNEL ID</label>
                            <input 
                              value={thresholdData.slackChannelId || ""}
                              onChange={e => setThresholdData({ ...thresholdData, slackChannelId: e.target.value })}
                              placeholder="C1234567890"
                              style={{ 
                                width: "100%", 
                                padding: "14px 18px", 
                                border: `1.5px solid ${T.border}`, 
                                borderRadius: 12, 
                                fontSize: 15, 
                                fontWeight: 600,
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>MANAGER ID</label>
                            <input 
                              value={thresholdData.slackManagerId || ""}
                              onChange={e => setThresholdData({ ...thresholdData, slackManagerId: e.target.value })}
                              placeholder="U1234567890"
                              style={{ 
                                width: "100%", 
                                padding: "14px 18px", 
                                border: `1.5px solid ${T.border}`, 
                                borderRadius: 12, 
                                fontSize: 15, 
                                fontWeight: 600,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end" }}>
                        <button 
                          onClick={() => setView("list")}
                          style={{ marginRight: 16, padding: "12px 32px", borderRadius: 10, border: `1.5px solid ${T.border}`, backgroundColor: "#fff", color: T.textDark, fontSize: 14, fontWeight: 800, cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={saveThresholdData}
                          disabled={thresholdSaving || !thresholdData.leadVendor}
                          style={{ 
                            padding: "12px 32px", 
                            borderRadius: 10, 
                            border: "none", 
                            backgroundColor: T.blue, 
                            color: "#fff", 
                            fontSize: 14, 
                            fontWeight: 800, 
                            cursor: "pointer", 
                            boxShadow: "0 4px 12px rgba(0,102,255,0.25)",
                            opacity: thresholdSaving || !thresholdData.leadVendor ? 0.5 : 1,
                          }}
                        >
                          {thresholdSaving ? "Saving..." : "Save Threshold Settings"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: 60, textAlign: "center", color: T.textMuted }}>
                      No threshold data available.
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                      <h3 style={{ fontSize: 18, fontWeight: 800, color: T.textDark, margin: 0 }}>Centre Team Setup</h3>
                      <button
                        onClick={() => setView("list")}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: `1px solid ${T.border}`,
                          backgroundColor: "#fff",
                          color: T.textDark,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Done
                      </button>
                    </div>
                    <div style={{ fontSize: 14, color: T.textMid }}>
                      Create new team members directly in this section and attach them to this centre.
                    </div>
                  </div>

                  <div style={{ marginBottom: 28, border: `1.5px solid ${T.border}`, borderRadius: 14, overflow: "hidden", backgroundColor: "#fff" }}>
                    <UserEditorComponent
                      onClose={() => {
                        // Keep onboarding context on Team Setup; do not bounce to centre list.
                      }}
                      onSubmit={async () => {
                        await fetchDirectory();
                        if (selectedCenter) {
                          const refreshed = buildCenterDetail(selectedCenter.id);
                          if (refreshed) {
                            setSelectedCenter(refreshed);
                            setEditingCenterName(refreshed.name);
                            setLogoUrl(refreshed.logo_url ?? null);
                          }
                        }
                        setToast({
                          message: "Team member created and assigned to centre.",
                          type: "success",
                        });
                      }}
                      presetRoleKey="call_center_admin"
                      allowedRoleKeys={["call_center_admin", "call_center_agent"]}
                      presetCenterId={selectedCenter.id}
                      lockCenter
                    />
                  </div>

                  <div style={{ border: `1.5px solid ${T.border}`, borderRadius: 14, overflow: "hidden", backgroundColor: "#fff" }}>
                    <div style={{ padding: "12px 16px", backgroundColor: "#EEF5EE", borderBottom: `1px solid ${T.border}`, fontSize: 13, fontWeight: 800, color: "#233217" }}>
                      Current Team Members
                    </div>
                    {users.filter((u) => u.callCenterId === selectedCenter.id).length === 0 ? (
                      <div style={{ padding: "16px", fontSize: 13, color: T.textMuted }}>No team members attached yet.</div>
                    ) : (
                      users
                        .filter((u) => u.callCenterId === selectedCenter.id)
                        .map((member) => (
                          <div
                            key={member.id}
                            style={{
                              padding: "12px 16px",
                              borderBottom: `1px solid ${T.borderLight}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 13, color: T.textDark, fontWeight: 700 }}>{member.name}</div>
                              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                                {member.roleKey === "call_center_admin" ? "Call Center Admin" : member.roleKey === "call_center_agent" ? "Call Center Agent" : (member.roleKey || "Role not set")}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                if (member.roleKey === "call_center_admin") {
                                  void handleRemoveAdmin();
                                } else {
                                  void handleRemoveAgent(member.id);
                                }
                              }}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 8,
                                border: "none",
                                backgroundColor: "#fef2f2",
                                color: "#b91c1c",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ))
                    )}
                  </div>

                </>
              )}
            </div>
          </div>

        </div>
        {toast && (
          <div style={{ 
            position: "fixed", 
            bottom: 24, 
            right: 24, 
            backgroundColor: toast.type === "success" ? "#233217" : "#dc2626", 
            color: "#fff", 
            padding: "12px 20px", 
            borderRadius: 10, 
            fontSize: 14, 
            fontWeight: 600,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            zIndex: 3000,
          }}>
            {toast.message}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "0", animation: "fadeIn 0.3s ease-out" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20, marginBottom: 24 }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          [
            { label: "Total Centers", value: centers.length.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              ) },
            { label: "Assigned Admins", value: centers.filter(c => c.admin).length.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              ) },
            { label: "Total Agents", value: centers.reduce((sum, c) => sum + c.agentCount, 0).toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ) },
            { label: "This Month", value: centers.filter(c => new Date(c.createdAt).getMonth() === new Date().getMonth()).length.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ) },
          ].map(({ label, value, color, icon }, i) => (
              <Card
                key={label}
                onMouseEnter={() => setHoveredStatIdx(i)}
                onMouseLeave={() => setHoveredStatIdx(null)}
                style={{
                  borderRadius: 16,
                  border: `1px solid ${T.border}`,
                  borderBottom: `4px solid ${color}`,
                  background: `linear-gradient(135deg, color-mix(in srgb, ${color} 20%, ${T.cardBg}) 0%, ${T.cardBg} 80%)`,
                  boxShadow:
                    hoveredStatIdx === i
                      ? "0 14px 40px rgba(28, 32, 26, 0.08), 0 4px 14px rgba(28, 32, 26, 0.05)"
                      : "0 4px 12px rgba(0,0,0,0.03)",
                  transform: hoveredStatIdx === i ? "translateY(-3px)" : "translateY(0)",
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
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#233217", letterSpacing: "0.45px", textTransform: "uppercase", lineHeight: 1.25 }}>{label}</span>
                  <div style={{ fontSize: 26, fontWeight: 800, color: color, lineHeight: 1.05, wordBreak: "break-all" }}>
                    {value}
                  </div>
                </div>
                <div
                  style={{
                    color,
                    backgroundColor:
                      hoveredStatIdx === i
                        ? `color-mix(in srgb, ${color} 24%, transparent)`
                        : `color-mix(in srgb, ${color} 15%, transparent)`,
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition:
                      "background-color 0.32s cubic-bezier(0.22, 1, 0.36, 1), transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
                    transform: hoveredStatIdx === i ? "scale(1.04)" : "scale(1)",
                  }}
                >
                  {icon}
                </div>
              </Card>
          ))
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 14 }}>
        <div
          style={{
            width: "100%",
            background: T.cardBg,
            border: `1px solid ${T.border}`,
            borderBottom: filterPanelExpanded ? "none" : `1px solid ${T.border}`,
            borderRadius: filterPanelExpanded ? "16px 16px 0 0" : 16,
            padding: "14px 20px",
            boxShadow: filterPanelExpanded ? "none" : T.shadowSm,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search
                size={16}
                style={{ position: "absolute", left: 12, pointerEvents: "none", zIndex: 1, color: T.textMuted }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search centres..."
                style={{
                  height: 38,
                  minWidth: 260,
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
                  e.currentTarget.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = T.border;
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => setFilterPanelExpanded((v) => !v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 38,
                padding: "0 16px",
                borderRadius: 10,
                border: filterPanelExpanded ? `1.5px solid #233217` : `1px solid ${T.border}`,
                background: filterPanelExpanded ? "#DCEBDC" : T.pageBg,
                color: filterPanelExpanded ? "#233217" : T.textDark,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: T.font,
                cursor: "pointer",
                transition: "all 0.15s ease-in-out",
              }}
            >
              <Filter size={16} />
              Filters
            </button>

            <button
              onClick={() => { handleOpenCreate(); }}
              style={{
                height: 38,
                padding: "0 18px",
                borderRadius: 10,
                border: "none",
                background: "#233217",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: T.font,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(35, 50, 23, 0.2)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Plus size={16} />
              Add Centre
            </button>
          </div>
        </div>

        {(filterPanelExpanded || hasActiveFilters) && (
          <div
            style={{
              width: "100%",
              background: T.cardBg,
              border: `1px solid ${T.border}`,
              borderRadius: "0 0 16px 16px",
              padding: "20px 24px",
              boxShadow: T.shadowSm,
              display: "flex",
              flexDirection: "column",
              gap: 20,
              overflow: "visible",
              position: "relative",
              zIndex: 50,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, alignItems: "end" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Admin Status</div>
                  <StyledSelect
                    value={filterAdmin}
                    onValueChange={(val) => setFilterAdmin(val as "All" | "Assigned" | "Unassigned")}
                    options={[
                      { value: "All", label: "All Admins" },
                      { value: "Assigned", label: "Assigned" },
                      { value: "Unassigned", label: "Unassigned" },
                    ]}
                    placeholder="All Admins"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                      Admin: {filterAdmin}
                      <button onClick={() => setFilterAdmin("All")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={clearFilters}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#233217",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "4px 0",
                      transition: "all 0.15s ease-in-out",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textDecoration = "underline";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.textDecoration = "none";
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
            <LoadingSpinner size={48} label="Loading centres..." />
          </div>
        ) : paginatedCenters.length === 0 ? (
          <div
            style={{
              padding: "60px 40px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: T.textMuted, marginBottom: 8 }}>No centres found</div>
            <div style={{ fontSize: 14, color: T.textMid }}>Add a centre or adjust your search filters.</div>
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
                    {[
                      { label: "Centre Name", align: "left" as const },
                      { label: "Admin", align: "left" as const },
                      { label: "Agents", align: "center" as const },
                      { label: "Created", align: "left" as const },
                      { label: "Actions", align: "center" as const },
                    ].map(({ label, align }) => (
                      <TableHead key={label} style={{ 
                        color: "#ffffff", 
                        fontWeight: 700, 
                        fontSize: 12, 
                        letterSpacing: "0.3px",
                        padding: "16px 20px",
                        whiteSpace: "nowrap",
                        textAlign: align
                      }}>
                        {label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCenters.map((center) => (
                    <TableRow 
                      key={center.id}
                      onClick={() => openEditModal(center)}
                      style={{ cursor: "pointer", borderBottom: `1px solid ${T.border}` }}
                      className="hover:bg-muted/30 transition-all duration-150"
                    >
                      <TableCell style={{ padding: "14px 20px" }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: T.textDark }}>
                          {center.name}
                        </span>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        {center.admin ? (
                          <span style={{ fontSize: 13, fontWeight: 500, color: T.textDark }}>
                            {center.admin.name}
                          </span>
                        ) : (
                          <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 500 }}>Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px", textAlign: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.textMid }}>{center.agentCount}</span>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        <span style={{ fontSize: 13, color: T.textMid, fontWeight: 400 }}>{center.createdAt}</span>
                      </TableCell>
                      <TableCell style={{ padding: "12px 16px", textAlign: "center" }}>
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, whiteSpace: "nowrap" }}
                        >
                          <button 
                            onClick={() => openEditModal(center)}
                            style={{ background: "none", border: "none", color: "#233217", cursor: "pointer", padding: 6, borderRadius: 6 }}
                            title="Edit Centre"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          {center.name.trim().toLowerCase().startsWith("inactive:") ? (
                            <button
                              onClick={() => handleReactivateCenterFromRow(center)}
                              style={{ background: "none", border: "none", color: "#166534", cursor: "pointer", padding: 6, borderRadius: 6 }}
                              title="Enable Centre"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/></svg>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDeactivateCenterFromRow(center)}
                              style={{ background: "none", border: "none", color: "#b45309", cursor: "pointer", padding: 6, borderRadius: 6 }}
                              title="Mark Centre Inactive"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>
                            </button>
                          )}
                          <button
                            onClick={() => openDeleteModal(center)}
                            style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: 6, borderRadius: 6 }}
                            title="Delete Centre"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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
                Showing {paginatedCenters.length} of {centers.length} centres
              </span>
            </div>
          </>
        )}
      </div>

      {showDeactivateModal && deactivatingCenter && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 520, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#b45309" }}>Deactivate Centre</h2>
              <button
                onClick={() => setShowDeactivateModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textMuted }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 14, color: "#92400e", lineHeight: 1.6 }}>
                <strong>Warning:</strong> This will rename <strong>"{deactivatingCenter.name}"</strong> to <strong>Inactive:{deactivatingCenter.name.replace(/^Inactive:/i, "").trim()}</strong> and set all linked users to inactive.
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                Type <strong>{deactivatingCenter.name}</strong> to confirm deactivation
              </label>
              <input
                type="text"
                value={deactivateConfirmName}
                onChange={(e) => setDeactivateConfirmName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && deactivateConfirmName === deactivatingCenter.name) void handleDeactivateCenterConfirm();
                  if (e.key === 'Escape') setShowDeactivateModal(false);
                }}
                placeholder={deactivatingCenter.name}
                autoFocus
                style={{
                  width: "100%",
                  height: 44,
                  border: `1.5px solid ${deactivateConfirmName === deactivatingCenter.name ? "#b45309" : T.border}`,
                  borderRadius: 10,
                  fontSize: 14,
                  color: T.textDark,
                  padding: "0 14px",
                  boxSizing: "border-box",
                  background: T.cardBg,
                  outline: "none",
                  fontFamily: T.font,
                  transition: "all 0.15s ease-in-out",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowDeactivateModal(false)}
                style={{
                  height: 42,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: "#fff",
                  color: T.textDark,
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivateCenterConfirm}
                disabled={deactivateConfirmName !== deactivatingCenter.name || deactivatingInProgress}
                style={{
                  height: 42,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: "none",
                  background: deactivateConfirmName === deactivatingCenter.name && !deactivatingInProgress ? "#b45309" : T.border,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: deactivateConfirmName === deactivatingCenter.name && !deactivatingInProgress ? "pointer" : "not-allowed",
                  boxShadow: deactivateConfirmName === deactivatingCenter.name && !deactivatingInProgress ? "0 4px 12px rgba(180, 83, 9, 0.2)" : "none",
                  transition: "all 0.15s ease-in-out",
                }}
              >
                {deactivatingInProgress ? "Deactivating..." : "Deactivate Centre"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && deletingCenter && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#dc2626" }}>Delete Centre</h2>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textMuted }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 14, color: "#991b1b", lineHeight: 1.6 }}>
                <strong>Warning:</strong> This will permanently delete <strong>"{deletingCenter.name}"</strong> and unassign all users. This action cannot be undone.
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                Type <strong>{deletingCenter.name}</strong> to confirm deletion
              </label>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && deleteConfirmName === deletingCenter.name) handleDeleteCenter();
                  if (e.key === 'Escape') setShowDeleteModal(false);
                }}
                placeholder={deletingCenter.name}
                autoFocus
                style={{
                  width: "100%",
                  height: 44,
                  border: `1.5px solid ${deleteConfirmName === deletingCenter.name ? "#dc2626" : T.border}`,
                  borderRadius: 10,
                  fontSize: 14,
                  color: T.textDark,
                  padding: "0 14px",
                  boxSizing: "border-box",
                  background: T.cardBg,
                  outline: "none",
                  fontFamily: T.font,
                  transition: "all 0.15s ease-in-out",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = deleteConfirmName === deletingCenter.name ? "#dc2626" : "#233217";
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${deleteConfirmName === deletingCenter.name ? "rgba(220, 38, 38, 0.1)" : "rgba(35, 50, 23, 0.1)"}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = deleteConfirmName === deletingCenter.name ? "#dc2626" : T.border;
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  height: 42,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: "#fff",
                  color: T.textDark,
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCenter}
                disabled={deleteConfirmName !== deletingCenter.name || deletingInProgress}
                style={{
                  height: 42,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: "none",
                  background: deleteConfirmName === deletingCenter.name && !deletingInProgress ? "#dc2626" : T.border,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: deleteConfirmName === deletingCenter.name && !deletingInProgress ? "pointer" : "not-allowed",
                  boxShadow: deleteConfirmName === deletingCenter.name && !deletingInProgress ? "0 4px 12px rgba(220, 38, 38, 0.2)" : "none",
                  transition: "all 0.15s ease-in-out",
                }}
              >
                {deletingInProgress ? "Deleting..." : "Delete Centre"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ 
          position: "fixed", 
          bottom: 24, 
          right: 24, 
          backgroundColor: toast.type === "success" ? "#233217" : "#dc2626", 
          color: "#fff", 
          padding: "12px 20px", 
          borderRadius: 10, 
          fontSize: 14, 
          fontWeight: 600,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          zIndex: 3000,
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}