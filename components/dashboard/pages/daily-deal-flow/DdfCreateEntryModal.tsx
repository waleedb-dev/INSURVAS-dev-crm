"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Input } from "@/components/ui";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Modal } from "./ui-primitives";
import { T } from "@/lib/theme";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type LeadSearchResult = {
  id: string;
  submission_id: string | null;
  lead_unique_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  lead_source: string | null;
  call_center_id: string | null;
  call_centers?: { name: string | null } | { name: string | null }[] | null;
};

function DdfStyledSelect({
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
          height: 40,
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
          {value ? options.find((option) => option.value === value)?.label || value : placeholder}
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
          zIndex: 4300,
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

type Props = {
  supabase: SupabaseClient;
  bufferAgentOptions?: string[];
  agentOptions?: string[];
  licensedOptions?: string[];
  carrierOptions?: string[];
  statusOptions?: string[];
  /** When set, stamped on insert so call-center RLS passes (must match the signed-in user's center). */
  callCenterId?: string | null;
  /** Call center roles must have a center on their profile before inserts succeed. */
  requireCallCenterId?: boolean;
  /** Opens the app-wide create-lead modal when search does not find a match. */
  onCreateLead?: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
};

export function DdfCreateEntryModal({
  supabase,
  bufferAgentOptions = [],
  agentOptions = [],
  licensedOptions = [],
  carrierOptions = [],
  statusOptions = [],
  callCenterId = null,
  requireCallCenterId = false,
  onCreateLead,
  onSuccess,
  onError,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadResults, setLeadResults] = useState<LeadSearchResult[]>([]);
  const [leadSearching, setLeadSearching] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadSearchResult | null>(null);
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

  const optionList = (dynamicOptions: string[], fallbackOptions: string[]) => {
    const values = [...new Set([...(dynamicOptions || []), ...fallbackOptions].filter(Boolean))];
    return values.map((v) => ({ value: v, label: v }));
  };

  const bufferOptions = useMemo(() => optionList(bufferAgentOptions, BUFFER_AGENT_OPTIONS), [bufferAgentOptions]);
  const agentSelectOptions = useMemo(() => optionList(agentOptions, AGENT_OPTIONS), [agentOptions]);
  const licensedSelectOptions = useMemo(() => optionList(licensedOptions, LICENSED_ACCOUNT_OPTIONS), [licensedOptions]);
  const carrierSelectOptions = useMemo(() => optionList(carrierOptions, CARRIER_OPTIONS), [carrierOptions]);
  const statusSelectOptions = useMemo(() => optionList(statusOptions, STATUS_OPTIONS), [statusOptions]);

  const setField = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const leadName = (lead: LeadSearchResult) => `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "Unnamed lead";

  const leadCallCenterName = (lead: LeadSearchResult): string | null => {
    const rel = lead.call_centers;
    if (Array.isArray(rel)) return rel[0]?.name ?? null;
    return rel?.name ?? null;
  };

  useEffect(() => {
    if (!open) return;
    const term = leadSearch.trim();
    if (term.length < 2) {
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      setLeadSearching(true);
      const safeTerm = term.replace(/[%,()]/g, " ");
      const terms = safeTerm.split(/\s+/).filter(Boolean).slice(0, 3);
      const filters = [
        `first_name.ilike.%${safeTerm}%`,
        `last_name.ilike.%${safeTerm}%`,
        `phone.ilike.%${safeTerm}%`,
        `lead_unique_id.ilike.%${safeTerm}%`,
        `submission_id.ilike.%${safeTerm}%`,
        ...terms.flatMap((part) => [`first_name.ilike.%${part}%`, `last_name.ilike.%${part}%`]),
      ];
      const { data, error } = await supabase
        .from("leads")
        .select("id, submission_id, lead_unique_id, first_name, last_name, phone, lead_source, call_center_id, call_centers(name)")
        .or(filters.join(","))
        .order("created_at", { ascending: false })
        .limit(8);
      if (cancelled) return;
      setLeadSearching(false);
      if (error) {
        setLeadResults([]);
        onError(error.message || "Failed to search leads.");
        return;
      }
      setLeadResults((data || []) as LeadSearchResult[]);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [leadSearch, onError, open, supabase]);

  const selectLead = (lead: LeadSearchResult) => {
    const name = leadName(lead);
    const submissionId = lead.submission_id || lead.id || generateCBSubmissionId();
    setSelectedLead(lead);
    setForm((prev) => ({
      ...prev,
      submission_id: submissionId,
      insured_name: name,
      client_phone_number: lead.phone || "",
      lead_vendor: leadCallCenterName(lead) || lead.lead_source || "",
    }));
  };

  const handleSubmit = async () => {
    if (!selectedLead) return onError("Search and select a lead before creating a Daily Deal Flow entry.");
    if (!form.insured_name.trim()) return onError("Customer name is required.");
    if (requireCallCenterId && !callCenterId) {
      return onError("Your account must be assigned to a call center before you can create entries. Ask an administrator to assign your center.");
    }
    setSaving(true);
    const selectedLeadCenterId = selectedLead.call_center_id || null;
    const resolvedCallCenterId = selectedLeadCenterId || callCenterId || null;
    const resolvedLeadVendor = selectedLead
      ? leadCallCenterName(selectedLead) || selectedLead.lead_source || null
      : callCenterId
      ? (
          await supabase
            .from("call_centers")
            .select("name")
            .eq("id", callCenterId)
            .maybeSingle()
        ).data?.name || null
      : null;
    const row: Record<string, unknown> = {
      submission_id: form.submission_id,
      date: form.date,
      lead_vendor: resolvedLeadVendor,
      insured_name: form.insured_name,
      client_phone_number: form.client_phone_number || null,
      buffer_agent: form.buffer_agent,
      agent: form.agent || null,
      licensed_agent_account: form.licensed_agent_account,
      status: form.status || null,
      call_result: form.call_result || null,
      carrier: form.carrier,
      product_type: form.product_type,
      draft_date: form.draft_date || null,
      monthly_premium: form.monthly_premium ? Number(form.monthly_premium) : null,
      face_amount: form.face_amount ? Number(form.face_amount) : null,
      notes: form.notes || null,
    };
    if (resolvedCallCenterId) {
      row.call_center_id = resolvedCallCenterId;
    }
    const { error } = await supabase.from("daily_deal_flow").insert(row);
    setSaving(false);
    if (error) {
      const message = error.code === "23505"
        ? "A Daily Deal Flow entry already exists for this lead on the selected date."
        : error.message || "Failed to create entry.";
      return onError(message);
    }
    setOpen(false);
    onSuccess();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          height: 38,
          padding: "0 16px",
          borderRadius: 14,
          border: "none",
          background: "#1b3211",
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: T.font,
          letterSpacing: 0,
        }}
      >
        Create Entry
      </button>
      <Modal open={open} title="Create New Daily Deal Flow Entry" onClose={() => setOpen(false)}>
        <div style={{ marginBottom: 16 }}>
          <Input
            label="Search Lead"
            placeholder="Search by name, phone, lead ID, or submission ID"
            value={leadSearch}
            onChange={(e) => setLeadSearch(e.currentTarget.value)}
          />
          <div style={{ marginTop: 8, border: "1px solid #dfe9d6", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
            {selectedLead ? (
              <div style={{ padding: 12, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", background: "#EEF5EE" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#233217" }}>{leadName(selectedLead)}</div>
                  <div style={{ fontSize: 12, color: "#617052", marginTop: 3 }}>
                    {selectedLead.phone || "No phone"} - {selectedLead.lead_unique_id || selectedLead.submission_id || selectedLead.id.slice(0, 8)}
                  </div>
                </div>
                <Button variant="ghost" onClick={() => setSelectedLead(null)}>Change</Button>
              </div>
            ) : leadSearch.trim().length < 2 ? (
              <div style={{ padding: 12, fontSize: 13, color: "#617052" }}>Type at least 2 characters to search leads.</div>
            ) : leadSearching ? (
              <div style={{ padding: 12, fontSize: 13, color: "#617052" }}>Searching leads...</div>
            ) : leadResults.length > 0 ? (
              leadResults.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => selectLead(lead)}
                  style={{
                    width: "100%",
                    border: "none",
                    borderBottom: "1px solid #edf4e6",
                    background: "#fff",
                    padding: "11px 12px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1c201a" }}>{leadName(lead)}</div>
                  <div style={{ fontSize: 12, color: "#617052", marginTop: 3 }}>
                    {lead.phone || "No phone"} - {lead.lead_unique_id || lead.submission_id || lead.id.slice(0, 8)} - {leadCallCenterName(lead) || lead.lead_source || "No vendor"}
                  </div>
                </button>
              ))
            ) : (
              <div style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13, color: "#617052" }}>No lead found.</span>
                {onCreateLead && (
                  <Button
                    onClick={() => {
                      setOpen(false);
                      onCreateLead();
                    }}
                  >
                    Create Lead
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(220px, 1fr))", gap: 12 }}>
          <Input label="Submission ID" value={form.submission_id} onChange={(e) => setField("submission_id", e.currentTarget.value)} />
          <Input label="Date" type="date" value={form.date} onChange={(e) => setField("date", e.currentTarget.value)} />
          <Input label="Lead Vendor" value={form.lead_vendor || "Auto from selected lead"} disabled />
          <Input label="Customer Name *" value={form.insured_name} onChange={(e) => setField("insured_name", e.currentTarget.value)} />
          <Input label="Phone Number" value={form.client_phone_number} onChange={(e) => setField("client_phone_number", e.currentTarget.value)} />
          <div><label style={{ fontSize: 12, fontWeight: 700 }}>Buffer Agent</label><DdfStyledSelect value={form.buffer_agent} onValueChange={(v) => setField("buffer_agent", v)} options={bufferOptions} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 700 }}>Agent</label><DdfStyledSelect value={form.agent} onValueChange={(v) => setField("agent", v)} options={agentSelectOptions} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 700 }}>Licensed Account</label><DdfStyledSelect value={form.licensed_agent_account} onValueChange={(v) => setField("licensed_agent_account", v)} options={licensedSelectOptions} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 700 }}>Status</label><DdfStyledSelect value={form.status} onValueChange={(v) => setField("status", v)} options={statusSelectOptions} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 700 }}>Call Result</label><DdfStyledSelect value={form.call_result} onValueChange={(v) => setField("call_result", v)} options={CALL_RESULT_OPTIONS.map((v) => ({ value: v, label: v }))} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 700 }}>Carrier</label><DdfStyledSelect value={form.carrier} onValueChange={(v) => setField("carrier", v)} options={carrierSelectOptions} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 700 }}>Product Type</label><DdfStyledSelect value={form.product_type} onValueChange={(v) => setField("product_type", v)} options={PRODUCT_TYPE_OPTIONS.map((v) => ({ value: v, label: v }))} /></div>
          <Input label="Draft Date" type="date" value={form.draft_date} onChange={(e) => setField("draft_date", e.currentTarget.value)} />
          <Input label="Monthly Premium" type="number" value={form.monthly_premium} onChange={(e) => setField("monthly_premium", e.currentTarget.value)} />
          <Input label="Face Amount" type="number" value={form.face_amount} onChange={(e) => setField("face_amount", e.currentTarget.value)} />
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>Notes</label>
          <textarea value={form.notes} onChange={(e) => setField("notes", e.currentTarget.value)} style={{ width: "100%", minHeight: 90, borderRadius: 8, border: "1px solid #c8d4bb", padding: 10 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={saving}
            style={{
              border: "none",
              background: "transparent",
              color: "#1c201a",
              fontSize: 15,
              fontWeight: 600,
              padding: "10px 12px",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            style={{
              border: "none",
              borderRadius: 18,
              background: "#1b3211",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              padding: "10px 18px",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Creating..." : "Create Entry"}
          </button>
        </div>
      </Modal>
    </>
  );
}
