"use client";

import { useState } from "react";
import { T } from "@/lib/theme";

const C = {
  bg: T.pageBg, white: T.cardBg, blue: T.blue,
  textDark: T.textDark, textMuted: T.textMuted, border: T.border,
  arrowUp: T.priorityHigh, arrowDown: T.priorityLow,
};

type EventType = "presentation" | "birthday" | "meeting-people" | "tv";

interface Event {
  id: string; title: string; when: string; duration: string;
  type: EventType; accent: string; direction: "up" | "down";
}

const INITIAL_EVENTS: Event[] = [
  { id:"E001", title:"Presentation of the new department", when:"Today | 6:00 PM",   duration:"4h",     type:"presentation",  accent:C.blue,    direction:"up" },
  { id:"E002", title:"Anna's Birthday",                   when:"Today | 5:00 PM",   duration:"2h",     type:"birthday",      accent:"#e879a0", direction:"down" },
  { id:"E003", title:"Meeting with Development Team",     when:"Tomorrow | 5:00 PM",duration:"4h",     type:"meeting-people",accent:"#f59e0b", direction:"up" },
  { id:"E004", title:"Ray's Birthday",                    when:"Tomorrow | 2:00 PM",duration:"1h 30m", type:"birthday",      accent:"#a855f7", direction:"down" },
  { id:"E005", title:"Meeting with CEO",                  when:"Sep 14 | 5:00 PM",  duration:"1h",     type:"presentation",  accent:C.blue,    direction:"up" },
  { id:"E006", title:"Movie night (Tenet)",               when:"Sep 15 | 5:00 PM",  duration:"3h",     type:"tv",            accent:"#a855f7", direction:"down" },
  { id:"E007", title:"Lucas's Birthday",                  when:"Sep 29 | 5:30 PM",  duration:"2h",     type:"birthday",      accent:"#e879a0", direction:"down" },
  { id:"E008", title:"Meeting with CTO",                  when:"Sep 30 | 12:00",    duration:"1h",     type:"presentation",  accent:C.blue,    direction:"up" },
];

interface Props { onBack: () => void; }

export default function NearestEventsPage({ onBack }: Props) {
  const [events, setEvents] = useState(INITIAL_EVENTS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = (ev: Event) => {
    setEvents((prev) => [ev, ...prev]);
    setShowAddModal(false);
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setTimeout(() => {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setDeletingId(null);
    }, 280);
  };

  return (
    <>
      <div>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <button id="back-to-dashboard" onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: C.blue, fontFamily: "inherit", padding: 0, marginBottom: 8, transition: "opacity 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke={C.blue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Back to Overview
            </button>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: C.textDark }}>Nearest Events</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted, fontWeight: 600 }}>{events.length} upcoming events</p>
          </div>
          <button id="add-event-btn" onClick={() => setShowAddModal(true)} style={{
            backgroundColor: C.blue, color: "#fff", border: "none", borderRadius: 12,
            padding: "12px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit",
            boxShadow: "0 4px 14px rgba(99,139,75,0.35)", transition: "opacity 0.15s, transform 0.1s",
          }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.opacity = "0.88"; el.style.transform = "scale(1.02)"; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.opacity = "1"; el.style.transform = "scale(1)"; }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3V13M3 8H13" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
            Add Event
          </button>
        </div>

        {/* Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {events.map((event) => (
            <EventCard
              key={event.id}
              {...event}
              isDeleting={deletingId === event.id}
              onDelete={() => handleDelete(event.id)}
            />
          ))}
        </div>
      </div>

      {showAddModal && <AddEventModal onClose={() => setShowAddModal(false)} onAdd={handleAdd} />}
    </>
  );
}

function EventCard({ id, title, when, duration, type, accent, direction, isDeleting, onDelete }: Event & { isDeleting: boolean; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: C.white, borderRadius: 16,
        padding: "18px 20px 16px",
        boxShadow: hovered ? "0 6px 20px rgba(0,0,0,0.08)" : "0 2px 8px rgba(0,0,0,0.04)",
        display: "flex", gap: 14, alignItems: "flex-start",
        transition: "box-shadow 0.2s, transform 0.2s, opacity 0.25s",
        transform: isDeleting ? "scale(0.95)" : hovered ? "translateY(-2px)" : "none",
        opacity: isDeleting ? 0 : 1,
        position: "relative",
      }}
    >
      <div style={{ width: 3, borderRadius: 2, backgroundColor: accent, minHeight: 50, flexShrink: 0, alignSelf: "stretch" }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
          <div style={{ flexShrink: 0, marginTop: 1 }}><EventTypeIcon type={type} accent={accent} /></div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.textDark, flex: 1, lineHeight: 1.4 }}>{title}</p>
          {direction === "up"
            ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 12V4M4 8L8 4L12 8" stroke={C.arrowUp} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 4V12M4 8L8 12L12 8" stroke={C.arrowDown} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          }
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{when}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: C.textMuted, fontWeight: 700, backgroundColor: C.bg, borderRadius: 6, padding: "3px 10px" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="#8a94a6" strokeWidth="1.3" /><path d="M6 3.5V6L7.5 7.5" stroke="#8a94a6" strokeWidth="1.3" strokeLinecap="round" /></svg>
            {duration}
          </span>
        </div>
      </div>

      {/* Delete button on hover */}
      {hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{
            position: "absolute", top: 10, right: 10, background: "#fff5f5", border: "none", borderRadius: 8,
            padding: "4px 6px", cursor: "pointer", color: "#ef4444", fontSize: 12, lineHeight: 1,
            animation: "fadeIn 0.15s ease", transition: "background-color 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#fee2e2"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#fff5f5"; }}
          title="Remove event"
        >✕</button>
      )}
    </div>
  );
}

function AddEventModal({ onClose, onAdd }: { onClose: () => void; onAdd: (ev: Event) => void }) {
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [duration, setDuration] = useState("1h");
  const [type, setType] = useState<EventType>("presentation");
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [accent, setAccent] = useState<string>(C.blue);
  const [error, setError] = useState("");

  const ACCENTS = [C.blue, "#e879a0", "#a855f7", "#f59e0b", "#22c55e", "#ef4444"];
  const TYPES: { id: EventType; label: string }[] = [
    { id: "presentation", label: "Presentation" },
    { id: "birthday", label: "Birthday" },
    { id: "meeting-people", label: "Meeting" },
    { id: "tv", label: "Other" },
  ];

  const handleSubmit = () => {
    if (!title.trim()) { setError("Please enter a title"); return; }
    if (!when.trim()) { setError("Please enter a date/time"); return; }
    onAdd({ id: `E${Date.now()}`, title: title.trim(), when: when.trim(), duration, type, accent, direction });
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.35)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn 0.18s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "#fff", borderRadius: 20, padding: "36px 36px 32px", width: "100%", maxWidth: 460, position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", animation: "fadeInDown 0.2s ease" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 18, right: 18, background: "none", border: "none", cursor: "pointer", color: "#8a94a6", fontSize: 18, lineHeight: 1, padding: 4, borderRadius: 8, transition: "color 0.15s" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#ef4444"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#8a94a6"; }}
        >✕</button>

        <h2 style={{ margin: "0 0 24px", fontSize: 20, fontWeight: 800, color: C.textDark }}>Add New Event</h2>

        {error && <div style={{ backgroundColor: "#fff5f5", color: "#ef4444", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{error}</div>}

        <Field label="Event Title">
          <input value={title} onChange={(e) => { setTitle(e.target.value); setError(""); }} placeholder="e.g. Team standup" style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#638b4b"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; }}
          />
        </Field>

        <Field label="Date & Time">
          <input value={when} onChange={(e) => { setWhen(e.target.value); setError(""); }} placeholder="e.g. Tomorrow | 3:00 PM" style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#638b4b"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; }}
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
          <Field label="Duration">
            <div style={{ position: "relative" }}>
              <select value={duration} onChange={(e) => setDuration(e.target.value)} style={{ ...inputStyle, paddingRight: 32, appearance: "none", cursor: "pointer" }}>
                {["30m","1h","1h 30m","2h","3h","4h","All day"].map((d) => <option key={d}>{d}</option>)}
              </select>
              <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#8a94a6", fontSize: 11 }}>▾</span>
            </div>
          </Field>
          <Field label="Type">
            <div style={{ position: "relative" }}>
              <select value={type} onChange={(e) => setType(e.target.value as EventType)} style={{ ...inputStyle, paddingRight: 32, appearance: "none", cursor: "pointer" }}>
                {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#8a94a6", fontSize: 11 }}>▾</span>
            </div>
          </Field>
        </div>

        <Field label="Priority">
          <div style={{ display: "flex", gap: 8 }}>
            {(["up", "down"] as const).map((d) => (
              <button key={d} onClick={() => setDirection(d)} style={{
                flex: 1, padding: "10px", borderRadius: 10, border: `1.5px solid ${direction === d ? (d === "up" ? C.arrowUp : C.arrowDown) : C.border}`,
                backgroundColor: direction === d ? (d === "up" ? "#fffbeb" : "#f0fdf4") : "#fff",
                cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                color: direction === d ? (d === "up" ? C.arrowUp : C.arrowDown) : C.textMuted,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s",
              }}>
                {d === "up" ? "↑ High" : "↓ Low"}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Accent Color">
          <div style={{ display: "flex", gap: 8 }}>
            {ACCENTS.map((a) => (
              <button key={a} onClick={() => setAccent(a)} style={{
                width: 28, height: 28, borderRadius: "50%", backgroundColor: a, border: `2.5px solid ${accent === a ? "#1a202c" : "transparent"}`,
                cursor: "pointer", transition: "transform 0.15s, border-color 0.15s",
                transform: accent === a ? "scale(1.15)" : "scale(1)",
              }} />
            ))}
          </div>
        </Field>

        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "13px", borderRadius: 12, border: `1.5px solid ${C.border}`, background: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", color: C.textMuted, transition: "border-color 0.15s" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#8a94a6"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
          >Cancel</button>
          <button onClick={handleSubmit} style={{ flex: 2, padding: "13px", borderRadius: 12, border: "none", backgroundColor: C.blue, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(99,139,75,0.3)", transition: "opacity 0.15s, transform 0.1s" }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.opacity = "0.88"; el.style.transform = "scale(0.99)"; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.opacity = "1"; el.style.transform = "scale(1)"; }}
          >Add Event</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#8a94a6", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", border: "1.5px solid #e2e8f0",
  borderRadius: 10, fontSize: 13, color: "#374151", fontFamily: "inherit",
  transition: "border-color 0.15s", boxSizing: "border-box", backgroundColor: "#fff",
};

function EventTypeIcon({ type, accent }: { type: EventType; accent: string }) {
  if (type === "birthday") return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="9" width="14" height="8" rx="2" stroke={accent} strokeWidth="1.4" />
      <path d="M6 9V7C6 5.9 6.9 5 8 5H10C11.1 5 12 5.9 12 7V9" stroke={accent} strokeWidth="1.4" />
      <path d="M6 5C6 4 7 3 7 3C7 3 7 4 6 5Z" fill={accent} /><path d="M9 5C9 4 10 3 10 3C10 3 10 4 9 5Z" fill={accent} /><path d="M12 5C12 4 13 3 13 3C13 3 13 4 12 5Z" fill={accent} />
      <path d="M2 12H16" stroke={accent} strokeWidth="1.2" strokeDasharray="2 2" />
    </svg>
  );
  if (type === "meeting-people") return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="7" r="3" stroke={accent} strokeWidth="1.4" />
      <circle cx="3.5" cy="8" r="2" stroke={accent} strokeWidth="1.2" />
      <circle cx="14.5" cy="8" r="2" stroke={accent} strokeWidth="1.2" />
      <path d="M1 14C1 12.34 2.12 11 3.5 11" stroke={accent} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M17 14C17 12.34 15.88 11 14.5 11" stroke={accent} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M4 16C4 13.8 6.24 12 9 12C11.76 12 14 13.8 14 16" stroke={accent} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
  if (type === "tv") return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="5" width="14" height="9" rx="2" stroke={accent} strokeWidth="1.4" />
      <path d="M6 14V16M12 14V16" stroke={accent} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M4 16H14" stroke={accent} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M5 3L9 5L13 3" stroke={accent} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="3" width="14" height="10" rx="2" stroke={accent} strokeWidth="1.4" />
      <path d="M5 7H13M5 10H9" stroke={accent} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M9 13V16M6 16H12" stroke={accent} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
