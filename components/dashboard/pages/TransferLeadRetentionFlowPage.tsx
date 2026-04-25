"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getTodayDateEST } from "./daily-deal-flow/helpers";

type RetentionMode = "new_sale" | "fixed_payment" | "carrier_requirements";

type LeadContext = {
  rowId: string;
  submissionId: string;
  leadUniqueId: string;
  name: string;
  phone: string;
};

type Props = {
  leadRowId: string;
  role: string;
};

export default function TransferLeadRetentionFlowPage({ leadRowId, role }: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<LeadContext | null>(null);
  const [mode, setMode] = useState<RetentionMode>("new_sale");
  const [carrier, setCarrier] = useState("");
  const [productType, setProductType] = useState("");
  const [coverageAmount, setCoverageAmount] = useState("");
  const [monthlyPremium, setMonthlyPremium] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "ok" | "error" } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("leads")
          .select("id, submission_id, lead_unique_id, first_name, last_name, phone")
          .eq("id", leadRowId)
          .maybeSingle();

        if (error || !data) {
          throw new Error(error?.message || "Lead not found.");
        }

        const context: LeadContext = {
          rowId: String(data.id),
          submissionId: String(data.submission_id || data.id),
          leadUniqueId: String(data.lead_unique_id || "N/A"),
          name: `${String(data.first_name || "").trim()} ${String(data.last_name || "").trim()}`.trim() || "Unnamed Lead",
          phone: String(data.phone || ""),
        };
        if (!cancelled) setLead(context);
      } catch (err) {
        if (!cancelled) {
          setMessage({
            text: err instanceof Error ? err.message : "Failed to load retention context.",
            type: "error",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [leadRowId, supabase]);

  const saveRetention = async () => {
    if (!lead) return;
    setSaving(true);
    setMessage(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;

      if (mode === "new_sale") {
        const { data: profile } = userId
          ? await supabase.from("users").select("call_center_id, call_centers(name)").eq("id", userId).maybeSingle()
          : { data: null as { call_center_id?: string | null; call_centers?: { name?: string } | null } | null };

        const row = profile as { call_center_id?: string | null; call_centers?: { name?: string } | null } | null;
        const { error: ddfError } = await supabase.from("daily_deal_flow").insert({
          lead_id: lead.rowId,
          lead_unique_id: lead.leadUniqueId,
          lead_name: lead.name,
          center_name: row?.call_centers?.name || null,
          call_center_id: row?.call_center_id || null,
          date: getTodayDateEST(),
        });
        if (ddfError) throw ddfError;
      }

      const { data: task, error: taskError } = await supabase
        .from("app_fix_tasks")
        .insert({
          submission_id: lead.submissionId,
          lead_id: lead.rowId,
          task_type: mode,
          status: "open",
          assigned_to: userId,
          notes: notes || null,
        })
        .select("id")
        .single();
      if (taskError || !task) throw taskError || new Error("Unable to create retention task.");

      if (mode === "fixed_payment") {
        const { error } = await supabase.from("app_fix_banking_updates").insert({
          task_id: task.id,
          submission_id: lead.submissionId,
          lead_id: lead.rowId,
          notes: notes || null,
        });
        if (error) throw error;
      } else if (mode === "carrier_requirements") {
        const { error } = await supabase.from("app_fix_carrier_requirements").insert({
          task_id: task.id,
          submission_id: lead.submissionId,
          lead_id: lead.rowId,
          carrier: carrier || null,
          product_type: productType || null,
          coverage_amount: coverageAmount || null,
          monthly_premium: monthlyPremium || null,
          notes: notes || null,
        });
        if (error) throw error;
      }

      const { error: sessionError } = await supabase
        .from("verification_sessions")
        .update({
          is_retention_call: true,
          status: "in_progress",
          retention_notes: {
            retentionType: mode,
            notes: notes || null,
            quoteCarrier: carrier || null,
            quoteProduct: productType || null,
            quoteCoverage: coverageAmount || null,
            quoteMonthlyPremium: monthlyPremium || null,
          },
        })
        .eq("submission_id", lead.submissionId);
      if (sessionError) throw sessionError;

      setMessage({ text: "Retention workflow saved.", type: "ok" });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Failed to save retention workflow.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p style={{ margin: 0, color: T.textMid, fontWeight: 700 }}>Loading retention flow...</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
        <button
          type="button"
          onClick={() => router.push(`/dashboard/${role}/transfer-leads/${leadRowId}`)}
          style={{ background: "none", border: "none", color: T.blue, fontWeight: 700, cursor: "pointer", padding: 0, marginBottom: 8 }}
        >
          Back to View Lead
        </button>
        <h2 style={{ margin: 0, fontSize: 22, color: T.textDark }}>Claim Retention</h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: T.textMid }}>
          {lead?.name || "Lead"} {lead?.phone ? `| ${lead.phone}` : ""}
        </p>
      </div>

      <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[
            ["new_sale", "New Sale"],
            ["fixed_payment", "Fixed Failed Payment"],
            ["carrier_requirements", "Carrier Requirements"],
          ].map(([value, label]) => {
            const selected = mode === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value as RetentionMode)}
                style={{
                  border: `1.5px solid ${selected ? T.blue : T.border}`,
                  backgroundColor: selected ? T.blueFaint : "#fff",
                  color: selected ? T.blue : T.textDark,
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {(mode === "new_sale" || mode === "carrier_requirements") && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Carrier" style={{ width: "100%", padding: "9px 10px", border: `1.5px solid ${T.border}`, borderRadius: 8 }} />
            <input value={productType} onChange={(e) => setProductType(e.target.value)} placeholder="Product type" style={{ width: "100%", padding: "9px 10px", border: `1.5px solid ${T.border}`, borderRadius: 8 }} />
            <input value={coverageAmount} onChange={(e) => setCoverageAmount(e.target.value)} placeholder="Coverage amount" style={{ width: "100%", padding: "9px 10px", border: `1.5px solid ${T.border}`, borderRadius: 8 }} />
            <input value={monthlyPremium} onChange={(e) => setMonthlyPremium(e.target.value)} placeholder="Monthly premium" style={{ width: "100%", padding: "9px 10px", border: `1.5px solid ${T.border}`, borderRadius: 8 }} />
          </div>
        )}

        <textarea
          rows={6}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Retention notes, outcomes, and next actions..."
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, resize: "vertical", fontFamily: T.font }}
        />

        {message && (
          <div
            style={{
              marginTop: 10,
              borderRadius: 8,
              border: `1px solid ${message.type === "ok" ? "#86efac" : "#fecaca"}`,
              backgroundColor: message.type === "ok" ? "#f0fdf4" : "#fef2f2",
              color: message.type === "ok" ? "#166534" : "#991b1b",
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {message.text}
          </div>
        )}

        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => void saveRetention()}
            disabled={saving}
            style={{
              border: "none",
              borderRadius: 8,
              backgroundColor: saving ? T.border : T.blue,
              color: "#fff",
              padding: "10px 14px",
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save Retention Flow"}
          </button>
        </div>
      </div>
    </div>
  );
}
