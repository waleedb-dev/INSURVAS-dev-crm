"use client";

import { useEffect, useState, useMemo } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  open: boolean;
  onClose: () => void;
  leadId: string | null;
  sessionUserId: string | null;
  onCreated: () => void;
};

export default function CreateLeadTicketModal({ open, onClose, leadId, sessionUserId, onCreated }: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!leadId || !sessionUserId || !title.trim()) return;
    setCreating(true);
    setError(null);
    const { error: insErr } = await supabase.from("tickets").insert({
      lead_id: leadId,
      publisher_id: sessionUserId,
      title: title.trim(),
      description: description.trim() || null,
    });
    setCreating(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    onCreated();
    onClose();
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
          maxWidth: 520,
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
          Call center admins publish tickets here. The assignee is the department’s Publisher Manager (set on the
          “publisher management” department row in the database).
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

        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMid, marginBottom: 6 }}>Title</label>
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
            marginBottom: 20,
          }}
        />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: `1px solid ${T.border}`,
              background: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: creating ? "not-allowed" : "pointer",
              fontFamily: T.font,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={creating || !title.trim()}
            onClick={() => void submit()}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              background: creating || !title.trim() ? T.border : "#233217",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: creating || !title.trim() ? "not-allowed" : "pointer",
              fontFamily: T.font,
            }}
          >
            {creating ? "Creating…" : "Create ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}
