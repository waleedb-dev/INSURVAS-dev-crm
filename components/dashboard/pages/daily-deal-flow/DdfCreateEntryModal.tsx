"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Modal, SelectInput } from "./ui-primitives";
import {
  AGENT_OPTIONS,
  BUFFER_AGENT_OPTIONS,
  CALL_RESULT_OPTIONS,
  CARRIER_OPTIONS,
  LICENSED_ACCOUNT_OPTIONS,
  PRODUCT_TYPE_OPTIONS,
  STATUS_OPTIONS,
} from "./constants";
import { getTodayDateEST } from "./helpers";

function generateCBSubmissionId(): string {
  const timestamp = Date.now().toString().slice(-8);
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `CB${randomDigits}${timestamp}`;
}

type Props = {
  supabase: SupabaseClient;
  leadVendorOptions: string[];
  /** When set, stamped on insert so call-center RLS passes (must match the signed-in user's center). */
  callCenterId?: string | null;
  /** Call center roles must have a center on their profile before inserts succeed. */
  requireCallCenterId?: boolean;
  onSuccess: () => void;
  onError: (message: string) => void;
};

export function DdfCreateEntryModal({
  supabase,
  leadVendorOptions,
  callCenterId = null,
  requireCallCenterId = false,
  onSuccess,
  onError,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    submission_id: generateCBSubmissionId(),
    date: getTodayDateEST(),
    lead_vendor: "",
    insured_name: "",
    client_phone_number: "",
    buffer_agent: "N/A",
    agent: "",
    licensed_agent_account: "N/A",
    status: "",
    call_result: "",
    carrier: "N/A",
    product_type: "N/A",
    draft_date: "",
    monthly_premium: "",
    face_amount: "",
    notes: "",
  }));

  const setField = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.insured_name.trim()) return onError("Customer name is required.");
    if (!form.status) return onError("Status is required.");
    if (!form.call_result) return onError("Call result is required.");
    if (requireCallCenterId && !callCenterId) {
      return onError("Your account must be assigned to a call center before you can create entries. Ask an administrator to assign your center.");
    }
    setSaving(true);
    const row: Record<string, unknown> = {
      submission_id: form.submission_id,
      date: form.date,
      lead_vendor: form.lead_vendor || null,
      insured_name: form.insured_name,
      client_phone_number: form.client_phone_number || null,
      buffer_agent: form.buffer_agent,
      agent: form.agent || null,
      licensed_agent_account: form.licensed_agent_account,
      status: form.status,
      call_result: form.call_result,
      carrier: form.carrier,
      product_type: form.product_type,
      draft_date: form.draft_date || null,
      monthly_premium: form.monthly_premium ? Number(form.monthly_premium) : null,
      face_amount: form.face_amount ? Number(form.face_amount) : null,
      notes: form.notes || null,
    };
    if (callCenterId) {
      row.call_center_id = callCenterId;
    }
    const { error } = await supabase.from("daily_deal_flow").insert(row);
    setSaving(false);
    if (error) return onError(error.message || "Failed to create entry.");
    setOpen(false);
    onSuccess();
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>Create New Entry</Button>
      <Modal open={open} title="Create New Daily Deal Flow Entry" onClose={() => setOpen(false)}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(220px, 1fr))", gap: 12 }}>
          <Input label="Submission ID" value={form.submission_id} onChange={(e) => setField("submission_id", e.currentTarget.value)} />
          <Input label="Date" type="date" value={form.date} onChange={(e) => setField("date", e.currentTarget.value)} />
          <div>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Lead Vendor</label>
            {leadVendorOptions.length > 0 ? (
              <SelectInput value={form.lead_vendor} onChange={(v) => setField("lead_vendor", String(v))} options={leadVendorOptions.map((v) => ({ value: v, label: v }))} style={{ width: "100%" }} />
            ) : (
              <Input value={form.lead_vendor} onChange={(e) => setField("lead_vendor", e.currentTarget.value)} placeholder="Vendor name (type if not listed yet)" />
            )}
          </div>
          <Input label="Customer Name *" value={form.insured_name} onChange={(e) => setField("insured_name", e.currentTarget.value)} />
          <Input label="Phone Number" value={form.client_phone_number} onChange={(e) => setField("client_phone_number", e.currentTarget.value)} />
          <div><label style={{ fontSize: 12, fontWeight: 700 }}>Buffer Agent</label><SelectInput value={form.buffer_agent} onChange={(v) => setField("buffer_agent", String(v))} options={BUFFER_AGENT_OPTIONS.map((v) => ({ value: v, label: v }))} style={{ width: "100%" }} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 700 }}>Agent</label><SelectInput value={form.agent} onChange={(v) => setField("agent", String(v))} options={AGENT_OPTIONS.map((v) => ({ value: v, label: v }))} style={{ width: "100%" }} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 700 }}>Licensed Account</label><SelectInput value={form.licensed_agent_account} onChange={(v) => setField("licensed_agent_account", String(v))} options={LICENSED_ACCOUNT_OPTIONS.map((v) => ({ value: v, label: v }))} style={{ width: "100%" }} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 700 }}>Status *</label><SelectInput value={form.status} onChange={(v) => setField("status", String(v))} options={STATUS_OPTIONS.map((v) => ({ value: v, label: v }))} style={{ width: "100%" }} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 700 }}>Call Result *</label><SelectInput value={form.call_result} onChange={(v) => setField("call_result", String(v))} options={CALL_RESULT_OPTIONS.map((v) => ({ value: v, label: v }))} style={{ width: "100%" }} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 700 }}>Carrier</label><SelectInput value={form.carrier} onChange={(v) => setField("carrier", String(v))} options={CARRIER_OPTIONS.map((v) => ({ value: v, label: v }))} style={{ width: "100%" }} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 700 }}>Product Type</label><SelectInput value={form.product_type} onChange={(v) => setField("product_type", String(v))} options={PRODUCT_TYPE_OPTIONS.map((v) => ({ value: v, label: v }))} style={{ width: "100%" }} /></div>
          <Input label="Draft Date" type="date" value={form.draft_date} onChange={(e) => setField("draft_date", e.currentTarget.value)} />
          <Input label="Monthly Premium" type="number" value={form.monthly_premium} onChange={(e) => setField("monthly_premium", e.currentTarget.value)} />
          <Input label="Face Amount" type="number" value={form.face_amount} onChange={(e) => setField("face_amount", e.currentTarget.value)} />
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>Notes</label>
          <textarea value={form.notes} onChange={(e) => setField("notes", e.currentTarget.value)} style={{ width: "100%", minHeight: 90, borderRadius: 8, border: "1px solid #c8d4bb", padding: 10 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} state={saving ? "loading" : "enabled"}>Create Entry</Button>
        </div>
      </Modal>
    </>
  );
}
