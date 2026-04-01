"use client";

import { useEffect, useState, useMemo } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { POLICY_FORM_SECTIONS, type PolicyRow } from "@/lib/policy-schema";
import {
  buildDraftFromPolicyRow,
  isoToDatetimeLocal,
  payloadFromDraft,
} from "@/lib/policy-form-utils";
import PolicyFormFields from "./PolicyFormFields";

type LeadRow = Record<string, unknown>;

type Props = {
  open: boolean;
  onClose: () => void;
  leadId: string | null;
  policyRow: PolicyRow | null;
  leadRow: LeadRow | null;
  onSaved: () => void;
};

function buildInitialDraft(policyRow: PolicyRow | null, leadRow: LeadRow | null): Record<string, string> {
  const fields = POLICY_FORM_SECTIONS.flatMap((s) => s.fields);
  const draft: Record<string, string> = {};
  for (const f of fields) draft[f.key] = "";

  if (policyRow) {
    return buildDraftFromPolicyRow(policyRow);
  }

  if (leadRow) {
    const fn = String(leadRow.first_name ?? "").trim();
    const ln = String(leadRow.last_name ?? "").trim();
    const fullName = [fn, ln].filter(Boolean).join(" ");
    if (fullName) {
      draft.deal_name = fullName;
      draft.ghl_name = fullName;
    }
    if (leadRow.phone) draft.phone_number = String(leadRow.phone);
    if (leadRow.carrier) draft.carrier = String(leadRow.carrier);
    if (leadRow.product_type) draft.policy_type = String(leadRow.product_type);
    const lv = leadRow.lead_value;
    if (lv != null && lv !== "") draft.deal_value = String(lv);
    const mp = leadRow.monthly_premium;
    if (mp != null && mp !== "") draft.cc_value = String(mp);
    draft.is_active = "true";

    const lic = leadRow.licensed_agent_account;
    if (lic != null && String(lic).trim() !== "") draft.sales_agent = String(lic).trim();

    const stage = leadRow.stage;
    if (stage != null && String(stage).trim() !== "") draft.ghl_stage = String(stage).trim();

    const mondayId = leadRow.monday_item_id ?? leadRow.monday_com_item_id;
    if (mondayId != null && String(mondayId).trim() !== "") draft.monday_item_id = String(mondayId).trim();

    if (leadRow.created_at) draft.lead_creation_date = isoToDatetimeLocal(String(leadRow.created_at));

    const sub = leadRow.submission_date;
    if (sub != null && String(sub).trim() !== "") {
      const subIso = isoToDatetimeLocal(String(sub));
      draft.effective_date = subIso;
      draft.deal_creation_date = subIso;
    } else if (leadRow.created_at) {
      const created = isoToDatetimeLocal(String(leadRow.created_at));
      draft.effective_date = created;
    }
  }
  return draft;
}

export default function ConvertClientPolicyModal({ open, onClose, leadId, policyRow, leadRow, onSaved }: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [callCenterNames, setCallCenterNames] = useState<string[]>([]);
  const [carrierNames, setCarrierNames] = useState<string[]>([]);
  const [stageNames, setStageNames] = useState<string[]>([]);
  const [lookupReady, setLookupReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setLookupReady(false);
      return;
    }
    setError(null);
    let cancelled = false;

    (async () => {
      setLookupReady(false);
      const pipelineId = leadRow?.pipeline_id;
      const stageQuery =
        pipelineId != null && String(pipelineId).trim() !== ""
          ? supabase.from("pipeline_stages").select("name").eq("pipeline_id", pipelineId).order("position")
          : Promise.resolve({ data: [] as { name: string | null }[] });

      const [ccRes, carRes, stRes] = await Promise.all([
        supabase.from("call_centers").select("id, name").order("name"),
        supabase.from("carriers").select("id, name").order("name"),
        stageQuery,
      ]);
      if (cancelled) return;

      const stageSorted = (stRes.data ?? [])
        .map((r: { name?: string | null }) => String(r.name ?? "").trim())
        .filter(Boolean);
      setStageNames(stageSorted);

      const ccSorted = (ccRes.data ?? [])
        .map((r: { name?: string | null }) => String(r.name ?? "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      const carSorted = (carRes.data ?? [])
        .map((r: { name?: string | null }) => String(r.name ?? "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

      setCallCenterNames(ccSorted);
      setCarrierNames(carSorted);

      const base = buildInitialDraft(policyRow, leadRow);

      if (!policyRow && leadRow?.call_center_id != null && String(leadRow.call_center_id).trim() !== "") {
        const id = String(leadRow.call_center_id);
        const match = (ccRes.data ?? []).find((r: { id: unknown }) => String(r.id) === id) as { name?: string | null } | undefined;
        if (match?.name && !base.call_center?.trim()) {
          base.call_center = String(match.name).trim();
        }
      }

      if (!cancelled) {
        setDraft(base);
        setLookupReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, policyRow, leadRow, supabase]);

  if (!open) return null;

  const isUpdate = policyRow != null && policyRow.id != null && policyRow.id !== "";

  const patch = (key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!leadId) {
      setError("Lead is not loaded.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = payloadFromDraft(draft, isUpdate);

    try {
      if (isUpdate) {
        const { error: upErr } = await supabase.from("policies").update(payload).eq("id", policyRow!.id as string | number);
        if (upErr) throw upErr;
      } else {
        const insertRow = { ...payload, lead_id: leadId };
        const { error: insErr } = await supabase.from("policies").insert(insertRow);
        if (insErr) throw insErr;
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Could not save policy.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.45)",
        zIndex: 4200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          backgroundColor: T.cardBg,
          borderRadius: 16,
          border: `1.5px solid ${T.border}`,
          boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="convert-client-policy-title"
      >
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <h2 id="convert-client-policy-title" style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.textDark }}>
            {isUpdate ? "Update policy" : "Convert to client — policy"}
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: T.textMid, lineHeight: 1.45 }}>
            Same fields as <strong>Policy &amp; coverage</strong>. {isUpdate ? "Save changes to the linked policy row." : "Creates a row in public.policies for this lead."}
          </p>
        </div>

        <div style={{ padding: "16px 22px", overflowY: "auto", flex: 1 }}>
          {error && (
            <div
              style={{
                marginBottom: 14,
                padding: "10px 12px",
                borderRadius: 10,
                background: "#fef2f2",
                border: `1px solid ${T.border}`,
                fontSize: 13,
                color: "#991b1b",
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          <PolicyFormFields
            draft={draft}
            onChange={patch}
            callCenterNames={callCenterNames}
            carrierNames={carrierNames}
            stageNames={stageNames}
            lookupReady={lookupReady}
          />
        </div>

        <div
          style={{
            padding: "14px 22px",
            borderTop: `1px solid ${T.border}`,
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            flexShrink: 0,
            background: T.rowBg,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              border: `1.5px solid ${T.border}`,
              background: "#fff",
              color: T.textDark,
              borderRadius: 10,
              padding: "10px 18px",
              fontWeight: 700,
              fontSize: 13,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving || !leadId || !lookupReady}
            style={{
              border: "none",
              background: saving || !leadId || !lookupReady ? T.border : T.blue,
              color: "#fff",
              borderRadius: 10,
              padding: "10px 20px",
              fontWeight: 700,
              fontSize: 13,
              cursor: saving || !leadId || !lookupReady ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : isUpdate ? "Save policy" : "Create policy"}
          </button>
        </div>
      </div>
    </div>
  );
}
