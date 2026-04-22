"use client";

import { useEffect, useState, useMemo } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Plus, X, Upload } from "lucide-react";

type TicketType = "general" | "billing" | "technical" | "escalation" | "compliance";
type TicketPriority = "low" | "medium" | "high" | "urgent";

type LeadOption = {
  id: string;
  lead_unique_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** If provided, the ticket is pre-linked to this lead. If null, user picks from a dropdown. */
  leadId: string | null;
  sessionUserId: string | null;
  onCreated: () => void;
};

const TYPE_OPTIONS: { value: TicketType; label: string }[] = [
  { value: "general", label: "General" },
  { value: "billing", label: "Billing" },
  { value: "technical", label: "Technical" },
  { value: "escalation", label: "Escalation" },
  { value: "compliance", label: "Compliance" },
];

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export default function CreateLeadTicketModal({ open, onClose, leadId: initialLeadId, sessionUserId, onCreated }: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ticketType, setTicketType] = useState<TicketType>("general");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(initialLeadId);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [userCallCenterId, setUserCallCenterId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Load user's call center and leads on open
  useEffect(() => {
    if (!open || !sessionUserId) return;
    let cancelled = false;

    (async () => {
      // Get user's call center
      const { data: userData } = await supabase
        .from("users")
        .select("call_center_id")
        .eq("id", sessionUserId)
        .maybeSingle();

      if (cancelled) return;
      const ccId = userData?.call_center_id ? String(userData.call_center_id) : null;
      setUserCallCenterId(ccId);

      // If no initialLeadId, fetch leads for dropdown
      if (!initialLeadId && ccId) {
        setLeadsLoading(true);
        const { data: leadsData } = await supabase
          .from("leads")
          .select("id, lead_unique_id, first_name, last_name, phone")
          .eq("call_center_id", ccId)
          .eq("is_draft", false)
          .order("created_at", { ascending: false })
          .limit(200);
        if (!cancelled) {
          setLeads((leadsData ?? []) as LeadOption[]);
          setLeadsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, sessionUserId, supabase, initialLeadId]);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setTicketType("general");
      setPriority("medium");
      setSelectedLeadId(initialLeadId);
      setFiles([]);
      setError(null);
    }
  }, [open, initialLeadId]);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length) {
      setFiles((prev) => [...prev, ...selected].slice(0, 5)); // max 5 files
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (): Promise<{ name: string; url: string }[]> => {
    if (files.length === 0) return [];
    setUploadingFiles(true);
    const uploaded: { name: string; url: string }[] = [];

    for (const file of files) {
      const path = `ticket-attachments/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("ticket-attachments").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) {
        console.error("File upload error:", upErr);
        continue;
      }
      const { data: urlData } = supabase.storage.from("ticket-attachments").getPublicUrl(path);
      uploaded.push({ name: file.name, url: urlData.publicUrl });
    }

    setUploadingFiles(false);
    return uploaded;
  };

  const submit = async () => {
    if (!selectedLeadId || !sessionUserId || !title.trim()) return;
    setCreating(true);
    setError(null);

    const attachments = await uploadAttachments();

    const { error: insErr } = await supabase.from("tickets").insert({
      lead_id: selectedLeadId,
      publisher_id: sessionUserId,
      title: title.trim(),
      description: description.trim() || null,
      ticket_type: ticketType,
      priority: priority,
      attachments: attachments.length ? attachments : null,
      call_center_id: userCallCenterId,
    });

    setCreating(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    onCreated();
    onClose();
  };

  const leadDisplay = (lead: LeadOption) => {
    const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim();
    return name || lead.lead_unique_id || lead.phone || lead.id;
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-ticket-modal-title"
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          overflow: "auto",
          backgroundColor: T.cardBg,
          borderRadius: 16,
          border: `1.5px solid ${T.border}`,
          boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
          padding: 22,
          fontFamily: T.font,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="create-ticket-modal-title" style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: T.textDark }}>
          New support ticket
        </h2>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: T.textMuted, lineHeight: 1.45 }}>
          Create a ticket for your call center. It will be routed to the appropriate manager.
        </p>

        {error && (
          <div
            style={{
              marginBottom: 14,
              padding: "10px 12px",
              borderRadius: 10,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* Lead selector (only when no initial lead) */}
        {!initialLeadId && (
          <>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMid, marginBottom: 6 }}>
              Lead *
            </label>
            <select
              value={selectedLeadId ?? ""}
              onChange={(e) => setSelectedLeadId(e.target.value || null)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                borderRadius: T.radiusSm,
                border: `1px solid ${T.border}`,
                fontSize: 14,
                fontFamily: T.font,
                marginBottom: 14,
                background: T.cardBg,
                color: T.textDark,
              }}
            >
              <option value="">{leadsLoading ? "Loading leads…" : "Select a lead…"}</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {leadDisplay(lead)}
                </option>
              ))}
            </select>
          </>
        )}

        {/* Type & Priority row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMid, marginBottom: 6 }}>
              Type
            </label>
            <select
              value={ticketType}
              onChange={(e) => setTicketType(e.target.value as TicketType)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                borderRadius: T.radiusSm,
                border: `1px solid ${T.border}`,
                fontSize: 14,
                fontFamily: T.font,
                background: T.cardBg,
                color: T.textDark,
              }}
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMid, marginBottom: 6 }}>
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                borderRadius: T.radiusSm,
                border: `1px solid ${T.border}`,
                fontSize: 14,
                fontFamily: T.font,
                background: T.cardBg,
                color: T.textDark,
              }}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMid, marginBottom: 6 }}>
          Title *
        </label>
        <input
          type="text"
          placeholder="Short summary"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 12px",
            borderRadius: T.radiusSm,
            border: `1px solid ${T.border}`,
            fontSize: 14,
            fontFamily: T.font,
            marginBottom: 14,
          }}
        />

        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMid, marginBottom: 6 }}>
          Description (optional)
        </label>
        <textarea
          placeholder="Details for the Publisher Manager…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 12px",
            borderRadius: T.radiusSm,
            border: `1px solid ${T.border}`,
            fontSize: 14,
            fontFamily: T.font,
            resize: "vertical",
            marginBottom: 14,
          }}
        />

        {/* File attachments */}
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMid, marginBottom: 6 }}>
          Attachments
        </label>
        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              border: `1.5px dashed ${T.border}`,
              background: T.pageBg,
              color: T.textDark,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#233217";
              e.currentTarget.style.background = "#f6f9f4";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = T.border;
              e.currentTarget.style.background = T.pageBg;
            }}
          >
            <Upload size={14} />
            Add files
            <input
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </label>
          <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>Max 5 files</span>

          {files.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
              {files.map((file, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 10px",
                    borderRadius: 8,
                    background: T.pageBg,
                    border: `1px solid ${T.border}`,
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontWeight: 600, color: T.textDark }}>{file.name}</span>
                  <button
                    onClick={() => removeFile(idx)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 2,
                      color: "#991b1b",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={creating || uploadingFiles}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: `1px solid ${T.border}`,
              background: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: creating || uploadingFiles ? "not-allowed" : "pointer",
              fontFamily: T.font,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={creating || uploadingFiles || !title.trim() || !selectedLeadId}
            onClick={() => void submit()}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              background: creating || uploadingFiles || !title.trim() || !selectedLeadId ? T.border : "#233217",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: creating || uploadingFiles || !title.trim() || !selectedLeadId ? "not-allowed" : "pointer",
              fontFamily: T.font,
            }}
          >
            {creating || uploadingFiles ? "Creating…" : "Create ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}
