"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Search, RefreshCw, Edit2, Trophy, Medal, TrendingUp, Save, X, ChevronDown } from "lucide-react";

// ── Reusable Input Component ─────────────────────────────────────────────────

function FormInput({ label, value, onChange, type = "text" }: { label: string; value?: string | number | boolean | null; onChange: (v: string | number | boolean) => void; type?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#647864", textTransform: "uppercase" }}>{label}</label>
      {type === "checkbox" ? (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          style={{ width: 20, height: 20, cursor: "pointer" }}
        />
      ) : type === "select" ? (
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          style={{
            padding: "10px",
            border: `1.5px solid ${T.border}`,
            borderRadius: T.radiusMd,
            fontSize: 14,
            fontFamily: "inherit",
            color: T.textDark,
            backgroundColor: T.cardBg,
            outline: "none",
          }}
        >
          <option value="A">Tier A</option>
          <option value="B">Tier B</option>
          <option value="C">Tier C</option>
        </select>
      ) : (
        <input
          type={type}
          value={typeof value === "boolean" ? "" : (value ?? "")}
          onChange={(e) => onChange(type === "number" ? parseFloat(e.target.value) : e.target.value)}
          style={{
            padding: "10px",
            border: `1.5px solid ${T.border}`,
            borderRadius: T.radiusMd,
            fontSize: 14,
            fontFamily: "inherit",
            color: T.textDark,
            backgroundColor: T.cardBg,
            outline: "none",
          }}
        />
      )}
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

interface CenterThreshold {
  id: string;
  center_name: string;
  lead_vendor: string;
  tier: "A" | "B" | "C";
  daily_transfer_target: number;
  daily_sales_target: number;
  max_dq_percentage: number;
  min_approval_ratio: number;
  transfer_weight: number;
  approval_ratio_weight: number;
  dq_weight: number;
  underwriting_threshold: number;
  is_active: boolean;
  slack_webhook_url: string | null;
  slack_channel: string | null;
  slack_manager_id: string | null;
  slack_channel_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function TierCard({ icon, title, subtitle, color, bg }: { icon: React.ReactNode; title: string; subtitle: string; color: string; bg: string }) {
  return (
    <Card
      style={{
        borderRadius: 16,
        border: `1px solid ${color}22`,
        background: bg,
        boxShadow: "none",
        padding: "20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: color + "18", display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color }}>{title}</p>
        <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 500, color: "#647864" }}>{subtitle}</p>
      </div>
    </Card>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderRadius: 8,
        backgroundColor: active ? "#dcfce7" : "#fee2e2",
        color: active ? "#166534" : "#991b1b",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: active ? "#22c55e" : "#ef4444" }} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function SlackBadge({ configured, info }: { configured: boolean; info?: string | null }) {
  if (!configured) {
    return (
      <span style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af" }}>
        Not configured
      </span>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, backgroundColor: "#dcfce7", color: "#166534", fontSize: 11, fontWeight: 700, width: "fit-content" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#22c55e" }} />
        Configured
      </span>
      {info && (
        <span style={{ fontSize: 11, fontWeight: 500, color: "#647864", wordBreak: "break-word" }}>
          {info}
        </span>
      )}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    A: { bg: "#dcfce7", color: "#166534" },
    B: { bg: "#fef3c7", color: "#b45309" },
    C: { bg: "#fee2e2", color: "#991b1b" },
  };
  const c = colors[tier] || { bg: "#e5e7eb", color: "#6b7280" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: c.bg,
        color: c.color,
        fontSize: 13,
        fontWeight: 800,
      }}
    >
      {tier}
    </span>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function CenterThresholdsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [thresholds, setThresholds] = useState<CenterThreshold[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("All");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CenterThreshold>>({});
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newForm, setNewForm] = useState<Partial<CenterThreshold>>({
    tier: "C",
    is_active: true,
    daily_transfer_target: 10,
    daily_sales_target: 5,
    max_dq_percentage: 20,
    min_approval_ratio: 20,
    transfer_weight: 40,
    approval_ratio_weight: 35,
    dq_weight: 25,
    underwriting_threshold: 5,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("center_thresholds").select("*").order("center_name", { ascending: true });
    if (error) {
      console.error("[CenterThresholds] fetch error:", error);
      setThresholds([]);
    } else {
      setThresholds((data || []) as CenterThreshold[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(timeout);
  }, [fetchData]);

  const handleEdit = (center: CenterThreshold) => {
    setEditingId(center.id);
    setEditForm({ ...center });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
    setShowAddForm(false);
    setNewForm({
      tier: "C",
      is_active: true,
      daily_transfer_target: 10,
      daily_sales_target: 5,
      max_dq_percentage: 20,
      min_approval_ratio: 20,
      transfer_weight: 40,
      approval_ratio_weight: 35,
      dq_weight: 25,
      underwriting_threshold: 5,
    });
  };

  const handleSave = async () => {
    if (!editingId || !editForm) return;
    setSaving(true);

    const payload = {
      ...editForm,
      updated_at: new Date().toISOString(),
    };
    delete (payload as Partial<CenterThreshold> & { created_at?: string; id?: string }).created_at;
    delete (payload as Partial<CenterThreshold> & { created_at?: string; id?: string }).id;

    const { error } = await supabase.from("center_thresholds").update(payload).eq("id", editingId);

    if (error) {
      console.error("[CenterThresholds] save error:", error);
      alert("Failed to save: " + error.message);
    } else {
      setEditingId(null);
      setEditForm({});
      void fetchData();
    }
    setSaving(false);
  };

  const handleCreate = async () => {
    if (!newForm.center_name || !newForm.lead_vendor) {
      alert("Center Name and Lead Vendor are required");
      return;
    }
    setSaving(true);

    const payload = {
      ...newForm,
      is_active: newForm.is_active ?? true,
      tier: newForm.tier || "C",
    };

    const { error } = await supabase.from("center_thresholds").insert(payload);

    if (error) {
      console.error("[CenterThresholds] create error:", error);
      alert("Failed to create: " + error.message);
    } else {
      setShowAddForm(false);
      setNewForm({
        tier: "C",
        is_active: true,
        daily_transfer_target: 10,
        daily_sales_target: 5,
        max_dq_percentage: 20,
        min_approval_ratio: 20,
        transfer_weight: 40,
        approval_ratio_weight: 35,
        dq_weight: 25,
        underwriting_threshold: 5,
      });
      void fetchData();
    }
    setSaving(false);
  };

  const filtered = useMemo(() => {
    return thresholds.filter((c) => {
      const matchesSearch =
        !searchTerm ||
        c.center_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.lead_vendor.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTier = tierFilter === "All" || c.tier === tierFilter;
      return matchesSearch && matchesTier;
    });
  }, [thresholds, searchTerm, tierFilter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, paddingBottom: 24 }}>
      {/* Tier Info Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        <TierCard
          icon={<Trophy size={20} />}
          title="Tier A - Premium"
          subtitle="Top performers with highest targets and expectations"
          color="#22c55e"
          bg="#f0fdf4"
        />
        <TierCard
          icon={<Medal size={20} />}
          title="Tier B - Standard"
          subtitle="Established centers with moderate targets"
          color="#f59e0b"
          bg="#fffbeb"
        />
        <TierCard
          icon={<TrendingUp size={20} />}
          title="Tier C - Developing"
          subtitle="New or growing centers with baseline targets"
          color="#ef4444"
          bg="#fef2f2"
        />
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "#233217", margin: 0 }}>Centers Configuration</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => void fetchData()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 16px",
              borderRadius: 12,
              border: `1px solid ${T.border}`,
              background: T.cardBg,
              color: T.textDark,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: T.font,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#647864" }} />
          <input
            type="text"
            placeholder="Search by center name or lead vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 10px 10px 36px",
              border: `1.5px solid ${T.border}`,
              borderRadius: T.radiusMd,
              fontSize: 14,
              fontFamily: "inherit",
              color: T.textDark,
              backgroundColor: T.cardBg,
              outline: "none",
            }}
          />
        </div>
        <div style={{ position: "relative" }}>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            style={{
              padding: "10px 32px 10px 14px",
              border: `1.5px solid ${T.border}`,
              borderRadius: T.radiusMd,
              fontSize: 14,
              fontFamily: "inherit",
              color: T.textDark,
              backgroundColor: T.cardBg,
              outline: "none",
              appearance: "none",
              cursor: "pointer",
            }}
          >
            <option value="All">All Tiers</option>
            <option value="A">Tier A</option>
            <option value="B">Tier B</option>
            <option value="C">Tier C</option>
          </select>
          <ChevronDown size={14} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#647864", pointerEvents: "none" }} />
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          style={{
            padding: "10px 18px",
            borderRadius: 12,
            border: "none",
            background: "#233217",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: T.font,
            cursor: "pointer",
          }}
        >
          {showAddForm ? "Cancel" : "+ Add Center"}
        </button>
      </div>

      {/* Add New Center Form */}
      {showAddForm && (
        <Card
          style={{
            borderRadius: 16,
            border: `2px dashed ${T.border}`,
            background: T.pageBg,
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#233217" }}>Add New Center</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
            <FormInput label="Center Name" value={newForm.center_name} onChange={(v) => setNewForm((f) => ({ ...f, center_name: v }))} />
            <FormInput label="Lead Vendor" value={newForm.lead_vendor} onChange={(v) => setNewForm((f) => ({ ...f, lead_vendor: v }))} />
            <FormInput label="Tier" value={newForm.tier} onChange={(v) => setNewForm((f) => ({ ...f, tier: v }))} type="select" />
            <FormInput label="Transfer Target" value={newForm.daily_transfer_target} onChange={(v) => setNewForm((f) => ({ ...f, daily_transfer_target: v }))} type="number" />
            <FormInput label="Sales Target" value={newForm.daily_sales_target} onChange={(v) => setNewForm((f) => ({ ...f, daily_sales_target: v }))} type="number" />
            <FormInput label="Max DQ %" value={newForm.max_dq_percentage} onChange={(v) => setNewForm((f) => ({ ...f, max_dq_percentage: v }))} type="number" />
            <FormInput label="Min Approval %" value={newForm.min_approval_ratio} onChange={(v) => setNewForm((f) => ({ ...f, min_approval_ratio: v }))} type="number" />
            <FormInput label="Underwriting Threshold" value={newForm.underwriting_threshold} onChange={(v) => setNewForm((f) => ({ ...f, underwriting_threshold: v }))} type="number" />
            <FormInput label="Active" value={newForm.is_active} onChange={(v) => setNewForm((f) => ({ ...f, is_active: v }))} type="checkbox" />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={handleCancel}
              style={{
                padding: "10px 18px",
                borderRadius: 12,
                border: `1.5px solid ${T.border}`,
                background: "transparent",
                color: T.textMuted,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => void handleCreate()}
              disabled={saving}
              style={{
                padding: "10px 24px",
                borderRadius: 12,
                border: "none",
                background: "#233217",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : "Create Center"}
            </button>
          </div>
        </Card>
      )}

      {/* Edit Form */}
      {editingId && editForm && (
        <Card
          style={{
            borderRadius: 16,
            border: `2px solid ${T.blue}`,
            background: T.pageBg,
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#233217" }}>Edit: {editForm.center_name}</h3>
            <button onClick={handleCancel} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              <X size={18} color="#647864" />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
            <FormInput label="Center Name" value={editForm.center_name} onChange={(v) => setEditForm((f) => ({ ...f, center_name: v }))} />
            <FormInput label="Lead Vendor" value={editForm.lead_vendor} onChange={(v) => setEditForm((f) => ({ ...f, lead_vendor: v }))} />
            <FormInput label="Tier" value={editForm.tier} onChange={(v) => setEditForm((f) => ({ ...f, tier: v }))} type="select" />
            <FormInput label="Transfer Target" value={editForm.daily_transfer_target} onChange={(v) => setEditForm((f) => ({ ...f, daily_transfer_target: v }))} type="number" />
            <FormInput label="Sales Target" value={editForm.daily_sales_target} onChange={(v) => setEditForm((f) => ({ ...f, daily_sales_target: v }))} type="number" />
            <FormInput label="Max DQ %" value={editForm.max_dq_percentage} onChange={(v) => setEditForm((f) => ({ ...f, max_dq_percentage: v }))} type="number" />
            <FormInput label="Min Approval %" value={editForm.min_approval_ratio} onChange={(v) => setEditForm((f) => ({ ...f, min_approval_ratio: v }))} type="number" />
            <FormInput label="Transfer Weight" value={editForm.transfer_weight} onChange={(v) => setEditForm((f) => ({ ...f, transfer_weight: v }))} type="number" />
            <FormInput label="Approval Weight" value={editForm.approval_ratio_weight} onChange={(v) => setEditForm((f) => ({ ...f, approval_ratio_weight: v }))} type="number" />
            <FormInput label="DQ Weight" value={editForm.dq_weight} onChange={(v) => setEditForm((f) => ({ ...f, dq_weight: v }))} type="number" />
            <FormInput label="Underwriting Threshold" value={editForm.underwriting_threshold} onChange={(v) => setEditForm((f) => ({ ...f, underwriting_threshold: v }))} type="number" />
            <FormInput label="Slack Webhook URL" value={editForm.slack_webhook_url} onChange={(v) => setEditForm((f) => ({ ...f, slack_webhook_url: v }))} />
            <FormInput label="Slack Channel" value={editForm.slack_channel} onChange={(v) => setEditForm((f) => ({ ...f, slack_channel: v }))} />
            <FormInput label="Slack Manager ID" value={editForm.slack_manager_id} onChange={(v) => setEditForm((f) => ({ ...f, slack_manager_id: v }))} />
            <FormInput label="Slack Channel ID" value={editForm.slack_channel_id} onChange={(v) => setEditForm((f) => ({ ...f, slack_channel_id: v }))} />
            <FormInput label="Active" value={editForm.is_active} onChange={(v) => setEditForm((f) => ({ ...f, is_active: v }))} type="checkbox" />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={handleCancel}
              style={{
                padding: "10px 18px",
                borderRadius: 12,
                border: `1.5px solid ${T.border}`,
                background: "transparent",
                color: T.textMuted,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              style={{
                padding: "10px 24px",
                borderRadius: 12,
                border: "none",
                background: "#233217",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Save size={14} />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </Card>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ borderRadius: 16, border: `1px solid ${T.border}`, backgroundColor: T.cardBg, padding: "80px 40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${T.border}`, borderTopColor: "#233217", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <Card style={{ borderRadius: 16, border: `1px solid ${T.border}`, background: T.cardBg, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: T.pageBg, borderBottom: `1.5px solid ${T.border}` }}>
                  {["Center Name", "Tier", "Transfer Target", "Sales Target", "Max DQ %", "Min Approval %", "Slack Config", "Status", "Actions"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "14px 16px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#647864",
                        textTransform: "uppercase",
                        letterSpacing: "0.4px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((center) => (
                  <tr
                    key={center.id}
                    style={{
                      borderBottom: `1px solid ${T.border}`,
                      transition: "background 150ms",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = T.pageBg;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                    }}
                  >
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#233217" }}>{center.center_name}</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#647864" }}>{center.lead_vendor}</span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <TierBadge tier={center.tier} />
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 700, color: "#233217" }}>
                      {center.daily_transfer_target}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 700, color: "#233217" }}>
                      {center.daily_sales_target}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 700, color: "#233217" }}>
                      {center.max_dq_percentage}%
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 700, color: "#233217" }}>
                      {center.min_approval_ratio}%
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <SlackBadge
                        configured={!!center.slack_webhook_url}
                        info={center.slack_channel ? `${center.slack_channel}${center.slack_manager_id ? ` @${center.slack_manager_id}` : ""}` : null}
                      />
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <StatusBadge active={center.is_active} />
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <button
                        onClick={() => handleEdit(center)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: `1px solid ${T.border}`,
                          background: T.cardBg,
                          color: T.textDark,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <Edit2 size={12} />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div style={{ padding: "60px 40px", textAlign: "center" }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: T.textMuted }}>No centers found matching your filters</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
