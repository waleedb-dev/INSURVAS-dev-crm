"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import * as z from "zod";
import { T } from "@/lib/theme";
import { X, Trash2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// StyledSelect component matching CallCenterLeadIntakePage design
function StyledSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  disabled = false,
  error = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(val) => onValueChange(val || "")} disabled={disabled}>
      <SelectTrigger
        style={{
          width: "100%",
          height: 42,
          borderRadius: 10,
          border: `1.5px solid ${error ? "#dc2626" : T.border}`,
          backgroundColor: disabled ? T.pageBg : "#fff",
          color: value ? T.textDark : T.textMuted,
          fontSize: 14,
          fontWeight: 600,
          paddingLeft: 14,
          paddingRight: 12,
          transition: "all 0.15s ease-in-out",
          boxShadow: error ? "0 0 0 3px rgba(220, 38, 38, 0.1)" : "none",
        }}
        className="hover:border-[#233217] focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
      >
        <SelectValue placeholder={placeholder}>
          {value
            ? options.find((o) => o.value === value)?.label || value
            : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        style={{
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          backgroundColor: "#fff",
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
              fontSize: 14,
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

// Import type from useLeadEdit to avoid circular dependencies
import type { LeadEditFormData } from "./useLeadEdit";

// Re-export the type for consumers
export type { LeadEditFormData } from "./useLeadEdit";

// Form validation schema matching the actual database schema
const formSchema = z.object({
  // Contact Information
  firstName: z.string().min(1, "First name is required").max(50, "First name must be at most 50 characters"),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name must be at most 50 characters"),
  phone: z.string().min(10, "Phone must be at least 10 digits").max(20, "Phone must be at most 20 characters"),
  
  // Address
  street1: z.string().max(200, "Street address must be at most 200 characters").optional(),
  street2: z.string().max(200, "Street address 2 must be at most 200 characters").optional(),
  city: z.string().max(100, "City must be at most 100 characters").optional(),
  state: z.string().max(50, "State must be at most 50 characters").optional(),
  zipCode: z.string().max(20, "ZIP code must be at most 20 characters").optional(),
  
  // Personal Details
  dateOfBirth: z.string().optional(),
  social: z.string().max(20, "SSN must be at most 20 characters").optional(),
  driverLicenseNumber: z.string().max(50, "Driver's license must be at most 50 characters").optional(),
  birthState: z.string().max(50, "Birth state must be at most 50 characters").optional(),
  age: z.string().max(10, "Age must be at most 10 characters").optional(),
  
  // Health & Underwriting
  height: z.string().max(20, "Height must be at most 20 characters").optional(),
  weight: z.string().max(20, "Weight must be at most 20 characters").optional(),
  tobaccoUse: z.string().optional(), // 'Yes' or 'No' in DB
  healthConditions: z.string().max(500, "Health conditions must be at most 500 characters").optional(),
  medications: z.string().max(500, "Medications must be at most 500 characters").optional(),
  doctorName: z.string().max(100, "Doctor name must be at most 100 characters").optional(),
  existingCoverage: z.string().optional(), // 'Yes' or 'No' in DB
  previousApplications: z.string().optional(), // 'Yes' or 'No' in DB
  
  // Pipeline & Stage (IDs for DB, names for display)
  pipelineId: z.number().nullable().or(z.literal("")),
  stageId: z.number().nullable().or(z.literal("")),
  pipelineName: z.string().optional(),
  stageName: z.string().optional(),
  
  // Opportunity Details
  leadValue: z.number().min(0, "Value must be positive").nullable().or(z.literal("")),
  licensedAgentAccount: z.string().optional(),
  leadSource: z.string().max(100, "Lead source must be at most 100 characters").optional(),
  tags: z.string().optional(),
  submissionDate: z.string().optional(),
  
  // Policy & Coverage - all text in DB
  carrier: z.string().max(100, "Carrier must be at most 100 characters").optional(),
  productType: z.string().max(100, "Product type must be at most 100 characters").optional(),
  coverageAmount: z.string().max(100, "Coverage amount must be at most 100 characters").optional(),
  monthlyPremium: z.string().max(100, "Monthly premium must be at most 100 characters").optional(),
  draftDate: z.string().optional(),
  futureDraftDate: z.string().optional(),
  beneficiaryInformation: z.string().max(500, "Beneficiary info must be at most 500 characters").optional(),
  additionalInformation: z.string().max(1000, "Additional info must be at most 1000 characters").optional(),
  
  // Banking Details
  bankAccountType: z.string().max(50, "Account type must be at most 50 characters").optional(),
  institutionName: z.string().max(100, "Institution name must be at most 100 characters").optional(),
  routingNumber: z.string().max(20, "Routing number must be at most 20 characters").optional(),
  accountNumber: z.string().max(50, "Account number must be at most 50 characters").optional(),
  
  // Language
  language: z.string().max(50, "Language must be at most 50 characters").optional(),
});

type NoteRow = {
  id: string;
  body: string;
  created_at: string;
  created_by: string | null;
  authorName?: string;
};

interface LeadEditFormProps {
  lead: LeadEditFormData;
  pipelines: { id: number; name: string }[];
  stages: { id: number; name: string }[];
  licensedAgents: { value: string; label: string }[];
  canEdit: boolean;
  onSubmit: (data: LeadEditFormData) => void;
  onCancel: () => void;
  onDelete?: () => void;
  isSaving?: boolean;
  isLoading?: boolean;
  isLoadingStages?: boolean;
  error?: string | null;
  title?: string;
  subtitle?: string;
  // Notes management props
  leadRowUuid: string | null;
  canEditNotes?: boolean;
  sessionUserId?: string | null;
  // Dynamic stage loading
  onPipelineChange?: (pipelineId: number | null) => void;
}

type TabType = "Opportunity Details" | "Personal Info" | "Policy & Banking" | "Notes";

// Field component with label and error display
function FormField({
  label,
  error,
  children,
  required = false,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: T.textMid,
          display: "flex",
          gap: 4,
        }}
      >
        {label}
        {required && <span style={{ color: "#dc2626" }}>*</span>}
      </label>
      {children}
      {error && (
        <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
          {error}
        </span>
      )}
    </div>
  );
}

// Input component styled for the form
function FormInput({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
  error,
  prefix,
}: {
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  error?: boolean;
  prefix?: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      {prefix && (
        <span
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 14,
            fontWeight: 600,
            color: T.textMuted,
            pointerEvents: "none",
          }}
        >
          {prefix}
        </span>
      )}
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: "100%",
          padding: prefix ? "12px 12px 12px 28px" : "12px",
          borderRadius: 8,
          border: `1.5px solid ${error ? "#dc2626" : T.border}`,
          fontSize: 14,
          fontWeight: 600,
          color: disabled ? T.textMuted : T.textDark,
          backgroundColor: disabled ? T.pageBg : "#fff",
          fontFamily: T.font,
          outline: "none",
          transition: "all 0.2s",
          boxShadow: error ? "0 0 0 3px rgba(220, 38, 38, 0.1)" : "none",
        }}
        onFocus={(e) => {
          if (!disabled && !error) {
            e.currentTarget.style.borderColor = T.blue;
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 139, 75, 0.12)";
          }
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? "#dc2626" : T.border;
          e.currentTarget.style.boxShadow = "none";
        }}
      />
    </div>
  );
}

// Textarea component
function FormTextarea({
  value,
  onChange,
  placeholder,
  disabled = false,
  error,
  rows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  rows?: number;
}) {
  return (
    <textarea
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      style={{
        width: "100%",
        padding: "12px",
        borderRadius: 8,
        border: `1.5px solid ${error ? "#dc2626" : T.border}`,
        fontSize: 14,
        fontWeight: 600,
        color: disabled ? T.textMuted : T.textDark,
        backgroundColor: disabled ? T.pageBg : "#fff",
        fontFamily: T.font,
        outline: "none",
        resize: "vertical",
        transition: "all 0.2s",
        boxShadow: error ? "0 0 0 3px rgba(220, 38, 38, 0.1)" : "none",
      }}
      onFocus={(e) => {
        if (!disabled && !error) {
          e.currentTarget.style.borderColor = T.blue;
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 139, 75, 0.12)";
        }
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = error ? "#dc2626" : T.border;
        e.currentTarget.style.boxShadow = "none";
      }}
    />
  );
}

// Format timestamp for display
function formatTs(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function LeadEditForm({
  lead,
  pipelines,
  stages,
  licensedAgents,
  canEdit,
  onSubmit,
  onCancel,
  onDelete,
  isSaving = false,
  isLoading = false,
  isLoadingStages = false,
  error = null,
  title = "Edit Lead",
  subtitle = "",
  // Notes management
  leadRowUuid,
  canEditNotes = true,
  sessionUserId = null,
  // Dynamic stage loading
  onPipelineChange,
}: LeadEditFormProps) {
  const supabase = getSupabaseBrowserClient();
  const [activeTab, setActiveTab] = React.useState<TabType>("Opportunity Details");
  
  // Notes state
  const [leadNotes, setLeadNotes] = React.useState<NoteRow[]>([]);
  const [notesLoading, setNotesLoading] = React.useState(false);
  const [newNoteText, setNewNoteText] = React.useState("");
  const [addingNote, setAddingNote] = React.useState(false);
  const [notesError, setNotesError] = React.useState<string | null>(null);

  // Delete note modal state
  const [showDeleteNoteModal, setShowDeleteNoteModal] = React.useState(false);
  const [deletingNote, setDeletingNote] = React.useState<NoteRow | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");
  const [deleteInProgress, setDeleteInProgress] = React.useState(false);

  const form = useForm<LeadEditFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: lead,
  });

  // Reset form when lead prop changes
  React.useEffect(() => {
    form.reset(lead);
  }, [lead, form]);

  // Watch pipelineId to conditionally enable/disable stage select
  const pipelineId = form.watch("pipelineId");

  const loadNotes = React.useCallback(async () => {
    if (!leadRowUuid) return;
    setNotesLoading(true);
    setNotesError(null);
    try {
      const { data: notes, error } = await supabase
        .from("lead_notes")
        .select("id, body, created_at, created_by")
        .eq("lead_id", leadRowUuid)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      const rows = (notes || []) as Pick<NoteRow, "id" | "body" | "created_at" | "created_by">[];
      const creatorIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
      let nameById: Record<string, string> = {};
      if (creatorIds.length) {
        const { data: users } = await supabase.from("users").select("id, full_name").in("id", creatorIds);
        if (users) {
          nameById = Object.fromEntries(users.map((u: { id: string; full_name: string | null }) => [u.id, u.full_name?.trim() || "User"]));
        }
      }
      setLeadNotes(
        rows.map((r) => ({
          ...r,
          authorName: r.created_by ? nameById[r.created_by] ?? "User" : "System",
        }))
      );
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : "Failed to load notes");
    } finally {
      setNotesLoading(false);
    }
  }, [leadRowUuid, supabase]);

  // Load notes when switching to Notes tab
  React.useEffect(() => {
    if (activeTab !== "Notes" || !leadRowUuid) return;
    loadNotes();
  }, [activeTab, leadRowUuid, loadNotes]);

  const addNote = React.useCallback(async () => {
    if (!leadRowUuid || !newNoteText.trim()) return;
    setAddingNote(true);
    setNotesError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in to add notes");

      const { error } = await supabase.from("lead_notes").insert({
        lead_id: leadRowUuid,
        body: newNoteText.trim(),
        created_by: user.id,
      });

      if (error) throw error;
      
      setNewNoteText("");
      await loadNotes();
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setAddingNote(false);
    }
  }, [leadRowUuid, newNoteText, supabase, loadNotes]);

  const openDeleteNoteModal = React.useCallback((note: NoteRow) => {
    setDeletingNote(note);
    setDeleteConfirmText("");
    setShowDeleteNoteModal(true);
  }, []);

  const handleDeleteNote = React.useCallback(async () => {
    if (!deletingNote) return;
    setDeleteInProgress(true);
    try {
      const { error } = await supabase.from("lead_notes").delete().eq("id", deletingNote.id);
      if (error) throw error;
      setShowDeleteNoteModal(false);
      setDeletingNote(null);
      setDeleteConfirmText("");
      await loadNotes();
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : "Failed to delete note");
    } finally {
      setDeleteInProgress(false);
    }
  }, [supabase, loadNotes, deletingNote]);

  const handleSubmit = form.handleSubmit((data) => {
    onSubmit(data);
  });

  const {
    control,
    formState: { errors },
  } = form;

  // Helper to render section headers
  const SectionHeader = ({ title }: { title: string }) => (
    <h3
      style={{
        margin: "24px 0 16px",
        fontSize: 14,
        fontWeight: 800,
        color: T.textDark,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        borderBottom: `2px solid ${T.borderLight}`,
        paddingBottom: 8,
      }}
    >
      {title}
    </h3>
  );

  // Yes/No select options for DB fields
  const yesNoOptions = [
    { value: "", label: "Select..." },
    { value: "Yes", label: "Yes" },
    { value: "No", label: "No" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: 12,
          width: "100%",
          maxWidth: 1100,
          height: "100%",
          maxHeight: 900,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px 32px",
            borderBottom: `1px solid ${T.borderLight}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 800,
                margin: "0 0 8px",
                color: T.textDark,
              }}
            >
              {title}
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: T.textMuted,
                fontWeight: 600,
              }}
            >
              {canEdit
                ? subtitle
                : "Read-only view — you do not have permission to edit."}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: T.textMuted,
              padding: 8,
              borderRadius: 8,
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = T.pageBg;
              e.currentTarget.style.color = T.textDark;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = T.textMuted;
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            style={{
              padding: "12px 32px",
              backgroundColor: "#fef2f2",
              color: "#b91c1c",
              fontSize: 13,
              fontWeight: 600,
              borderBottom: `1px solid ${T.borderLight}`,
            }}
          >
            {error}
          </div>
        )}

        {/* Content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Loading Overlay */}
          {isLoading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(255,255,255,0.7)",
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 700,
                color: T.textMuted,
              }}
            >
              Loading lead…
            </div>
          )}

          {/* Sidebar */}
          <div
            style={{
              width: 200,
              borderRight: `1px solid ${T.borderLight}`,
              padding: "16px 8px",
              backgroundColor: "#fcfdff",
              flexShrink: 0,
            }}
          >
            {(["Opportunity Details", "Personal Info", "Policy & Banking", "Notes"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "none",
                  borderRadius: 8,
                  textAlign: "left",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  backgroundColor:
                    activeTab === tab ? "#DCEBDC" : "transparent",
                  color: activeTab === tab ? "#233217" : T.textMuted,
                  marginBottom: 4,
                  transition: "all 0.2s",
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Form Content */}
          <div
            style={{
              flex: 1,
              padding: "24px 32px",
              overflowY: "auto",
              backgroundColor: "#fff",
            }}
          >
            <form id="lead-edit-form" onSubmit={handleSubmit}>
              {activeTab === "Opportunity Details" && (
                <div style={{ maxWidth: 900 }}>
                  {/* Contact Section */}
                  <SectionHeader title="Contact Information" />
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 20,
                    }}
                  >
                    <Controller
                      name="firstName"
                      control={control}
                      render={({ field }) => (
                        <FormField label="First Name" error={errors.firstName?.message} required>
                          <FormInput
                            value={field.value}
                            onChange={field.onChange}
                            disabled={!canEdit}
                            error={!!errors.firstName}
                          />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="lastName"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Last Name" error={errors.lastName?.message} required>
                          <FormInput
                            value={field.value}
                            onChange={field.onChange}
                            disabled={!canEdit}
                            error={!!errors.lastName}
                          />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="phone"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Phone" error={errors.phone?.message} required>
                          <FormInput
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="+1 (555) 000-0000"
                            disabled={!canEdit}
                            error={!!errors.phone}
                          />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="language"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Preferred Language">
                          <FormInput
                            value={field.value || ""}
                            onChange={field.onChange}
                            placeholder="e.g., English, Spanish"
                            disabled={!canEdit}
                          />
                        </FormField>
                      )}
                    />
                  </div>

                  {/* Pipeline & Stage */}
                  <SectionHeader title="Pipeline & Stage" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    <Controller
                      name="pipelineId"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Pipeline" error={errors.pipelineId?.message} required>
                          <StyledSelect
                            value={field.value?.toString() || ""}
                            onValueChange={(val) => {
                              const newPipelineId = val ? Number(val) : null;
                              field.onChange(newPipelineId);
                              // Reset stage when pipeline changes
                              form.setValue("stageId", null, { shouldValidate: false });
                              // Fetch stages for new pipeline
                              onPipelineChange?.(newPipelineId);
                            }}
                            options={pipelines.map((p) => ({ value: p.id.toString(), label: p.name }))}
                            placeholder="Select pipeline..."
                            disabled={!canEdit}
                            error={!!errors.pipelineId}
                          />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="stageId"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Stage" error={errors.stageId?.message} required>
                          <StyledSelect
                            value={field.value?.toString() || ""}
                            onValueChange={(val) => field.onChange(val ? Number(val) : null)}
                            options={stages.map((s) => ({ value: s.id.toString(), label: s.name }))}
                            placeholder={isLoadingStages ? "Loading stages..." : pipelineId ? "Select stage..." : "Select pipeline first"}
                            disabled={!canEdit || !pipelineId || isLoadingStages}
                            error={!!errors.stageId}
                          />
                        </FormField>
                      )}
                    />
                  </div>

                  {/* Opportunity Details */}
                  <SectionHeader title="Opportunity Details" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    <Controller
                      name="leadValue"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Opportunity Value" error={errors.leadValue?.message}>
                          <FormInput
                            value={field.value ?? ""}
                            onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                            type="number"
                            prefix="$"
                            placeholder="0"
                            disabled={!canEdit}
                            error={!!errors.leadValue}
                          />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="licensedAgentAccount"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Owner (Licensed Agent)">
                          <StyledSelect
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            options={[{ value: "", label: "Unassigned" }, ...licensedAgents]}
                            placeholder="Select owner..."
                            disabled={!canEdit}
                          />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="leadSource"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Opportunity Source" error={errors.leadSource?.message}>
                          <FormInput
                            value={field.value || ""}
                            onChange={field.onChange}
                            disabled={!canEdit}
                            error={!!errors.leadSource}
                          />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="submissionDate"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Submission Date">
                          <FormInput
                            value={field.value || ""}
                            onChange={field.onChange}
                            type="date"
                            disabled={!canEdit}
                          />
                        </FormField>
                      )}
                    />
                    <div style={{ gridColumn: "1 / -1" }}>
                      <Controller
                        name="tags"
                        control={control}
                        render={({ field }) => (
                          <FormField label="Tags" error={errors.tags?.message}>
                            <FormInput
                              value={field.value || ""}
                              onChange={field.onChange}
                              placeholder="comma-separated tags"
                              disabled={!canEdit}
                              error={!!errors.tags}
                            />
                          </FormField>
                        )}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "Personal Info" && (
                <div style={{ maxWidth: 900 }}>
                  {/* Address */}
                  <SectionHeader title="Address" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    <Controller
                      name="street1"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Street Address" error={errors.street1?.message}>
                          <FormInput value={field.value || ""} onChange={field.onChange} disabled={!canEdit} error={!!errors.street1} />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="street2"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Apartment, Suite, etc." error={errors.street2?.message}>
                          <FormInput value={field.value || ""} onChange={field.onChange} disabled={!canEdit} error={!!errors.street2} />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="city"
                      control={control}
                      render={({ field }) => (
                        <FormField label="City" error={errors.city?.message}>
                          <FormInput value={field.value || ""} onChange={field.onChange} disabled={!canEdit} error={!!errors.city} />
                        </FormField>
                      )}
                    />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                      <Controller
                        name="state"
                        control={control}
                        render={({ field }) => (
                          <FormField label="State" error={errors.state?.message}>
                            <FormInput value={field.value || ""} onChange={field.onChange} disabled={!canEdit} error={!!errors.state} />
                          </FormField>
                        )}
                      />
                      <Controller
                        name="zipCode"
                        control={control}
                        render={({ field }) => (
                          <FormField label="ZIP Code" error={errors.zipCode?.message}>
                            <FormInput value={field.value || ""} onChange={field.onChange} disabled={!canEdit} error={!!errors.zipCode} />
                          </FormField>
                        )}
                      />
                    </div>
                  </div>

                  {/* Personal Details */}
                  <SectionHeader title="Personal Details" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
                    <Controller
                      name="dateOfBirth"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Date of Birth">
                          <FormInput value={field.value || ""} onChange={field.onChange} type="date" disabled={!canEdit} />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="social"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Social Security Number" error={errors.social?.message}>
                          <FormInput value={field.value || ""} onChange={field.onChange} placeholder="XXX-XX-XXXX" disabled={!canEdit} error={!!errors.social} />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="driverLicenseNumber"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Driver's License" error={errors.driverLicenseNumber?.message}>
                          <FormInput value={field.value || ""} onChange={field.onChange} disabled={!canEdit} error={!!errors.driverLicenseNumber} />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="birthState"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Birth State" error={errors.birthState?.message}>
                          <FormInput value={field.value || ""} onChange={field.onChange} disabled={!canEdit} error={!!errors.birthState} />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="age"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Age" error={errors.age?.message}>
                          <FormInput value={field.value || ""} onChange={field.onChange} disabled={!canEdit} error={!!errors.age} />
                        </FormField>
                      )}
                    />
                  </div>

                  {/* Health & Underwriting */}
                  <SectionHeader title="Health & Underwriting" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
                    <Controller
                      name="height"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Height" error={errors.height?.message}>
                          <FormInput value={field.value || ""} onChange={field.onChange} placeholder="e.g., 5ft 10in" disabled={!canEdit} error={!!errors.height} />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="weight"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Weight" error={errors.weight?.message}>
                          <FormInput value={field.value || ""} onChange={field.onChange} placeholder="e.g., 180 lbs" disabled={!canEdit} error={!!errors.weight} />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="tobaccoUse"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Tobacco Use">
                          <StyledSelect
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            options={yesNoOptions}
                            placeholder="Select..."
                            disabled={!canEdit}
                          />
                        </FormField>
                      )}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
                    <Controller
                      name="existingCoverage"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Existing Coverage (Last 2 Years)">
                          <StyledSelect
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            options={yesNoOptions}
                            placeholder="Select..."
                            disabled={!canEdit}
                          />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="previousApplications"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Previous Applications (Last 2 Years)">
                          <StyledSelect
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            options={yesNoOptions}
                            placeholder="Select..."
                            disabled={!canEdit}
                          />
                        </FormField>
                      )}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
                    <Controller
                      name="healthConditions"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Health Conditions" error={errors.healthConditions?.message}>
                          <FormTextarea value={field.value || ""} onChange={field.onChange} placeholder="List any health conditions..." disabled={!canEdit} error={!!errors.healthConditions} rows={3} />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="medications"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Current Medications" error={errors.medications?.message}>
                          <FormTextarea value={field.value || ""} onChange={field.onChange} placeholder="List current medications..." disabled={!canEdit} error={!!errors.medications} rows={3} />
                        </FormField>
                      )}
                    />
                  </div>
                  <div style={{ marginTop: 20 }}>
                    <Controller
                      name="doctorName"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Doctor Name" error={errors.doctorName?.message}>
                          <FormInput value={field.value || ""} onChange={field.onChange} placeholder="Primary care physician" disabled={!canEdit} error={!!errors.doctorName} />
                        </FormField>
                      )}
                    />
                  </div>
                </div>
              )}

              {activeTab === "Policy & Banking" && (
                <div style={{ maxWidth: 900 }}>
                  {/* Policy & Coverage */}
                  <SectionHeader title="Policy & Coverage" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    <Controller
                      name="carrier"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Carrier" error={errors.carrier?.message}>
                          <FormInput value={field.value || ""} onChange={field.onChange} disabled={!canEdit} error={!!errors.carrier} />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="productType"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Product Type" error={errors.productType?.message}>
                          <FormInput value={field.value || ""} onChange={field.onChange} disabled={!canEdit} error={!!errors.productType} />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="coverageAmount"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Coverage Amount" error={errors.coverageAmount?.message}>
                          <FormInput value={field.value || ""} onChange={field.onChange} placeholder="e.g., $100,000" disabled={!canEdit} error={!!errors.coverageAmount} />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="monthlyPremium"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Monthly Premium" error={errors.monthlyPremium?.message}>
                          <FormInput value={field.value || ""} onChange={field.onChange} placeholder="e.g., $50.00" disabled={!canEdit} error={!!errors.monthlyPremium} />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="draftDate"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Draft Date">
                          <FormInput value={field.value || ""} onChange={field.onChange} type="date" disabled={!canEdit} />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="futureDraftDate"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Future Draft Date">
                          <FormInput value={field.value || ""} onChange={field.onChange} type="date" disabled={!canEdit} />
                        </FormField>
                      )}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
                    <Controller
                      name="beneficiaryInformation"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Beneficiary Information" error={errors.beneficiaryInformation?.message}>
                          <FormTextarea value={field.value || ""} onChange={field.onChange} placeholder="Beneficiary details..." disabled={!canEdit} error={!!errors.beneficiaryInformation} rows={3} />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="additionalInformation"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Additional Information" error={errors.additionalInformation?.message}>
                          <FormTextarea value={field.value || ""} onChange={field.onChange} placeholder="Any additional notes..." disabled={!canEdit} error={!!errors.additionalInformation} rows={3} />
                        </FormField>
                      )}
                    />
                  </div>

                  {/* Banking Details */}
                  <SectionHeader title="Banking Details" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    <Controller
                      name="bankAccountType"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Account Type" error={errors.bankAccountType?.message}>
                          <StyledSelect
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            options={[
                              { value: "", label: "None" },
                              { value: "checking", label: "Checking" },
                              { value: "savings", label: "Savings" },
                            ]}
                            placeholder="Select account type..."
                            disabled={!canEdit}
                            error={!!errors.bankAccountType}
                          />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="institutionName"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Institution Name" error={errors.institutionName?.message}>
                          <FormInput value={field.value || ""} onChange={field.onChange} disabled={!canEdit} error={!!errors.institutionName} />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="routingNumber"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Routing Number" error={errors.routingNumber?.message}>
                          <FormInput value={field.value || ""} onChange={field.onChange} disabled={!canEdit} error={!!errors.routingNumber} />
                        </FormField>
                      )}
                    />
                    <Controller
                      name="accountNumber"
                      control={control}
                      render={({ field }) => (
                        <FormField label="Account Number" error={errors.accountNumber?.message}>
                          <FormInput value={field.value || ""} onChange={field.onChange} disabled={!canEdit} error={!!errors.accountNumber} />
                        </FormField>
                      )}
                    />
                  </div>
                </div>
              )}

              {activeTab === "Notes" && (
                <div style={{ maxWidth: 720 }}>
                  {/* Notes Tab Content */}
                  <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800, color: T.textDark }}>Notes</h3>
                 

                  {notesError && (
                    <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>
                      {notesError}
                    </div>
                  )}

                  {/* Add Note Section */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Add a note</label>
                    <textarea
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder="Type a note and click Add note — saves immediately."
                      disabled={!canEditNotes || addingNote}
                      rows={4}
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        borderRadius: 10,
                        border: `1.5px solid ${T.border}`,
                        fontSize: 14,
                        fontFamily: T.font,
                        resize: "vertical",
                        outline: "none",
                        marginBottom: 10,
                        backgroundColor: !canEditNotes ? T.pageBg : "#fff",
                      }}
                    />
                    <button
                      type="button"
                      disabled={!canEditNotes || addingNote || !newNoteText.trim()}
                      onClick={() => void addNote()}
                      style={{
                        background: "#233217",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "10px 20px",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: canEditNotes && !addingNote && newNoteText.trim() ? "pointer" : "not-allowed",
                        opacity: canEditNotes && !addingNote && newNoteText.trim() ? 1 : 0.55,
                      }}
                    >
                      {addingNote ? "Adding…" : "Add note"}
                    </button>
                  </div>

                  {/* Notes History */}
                  <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 800, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>History</h4>

                  {notesLoading ? (
                    <p style={{ color: T.textMuted, fontSize: 14 }}>Loading notes…</p>
                  ) : leadNotes.length === 0 ? (
                    <p style={{ color: T.textMuted, fontSize: 14, padding: "16px", background: T.pageBg, borderRadius: 10, border: `1px dashed ${T.border}` }}>
                      No notes yet. Add one above.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
                      {leadNotes.map((note) => (
                        <div key={note.id} style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>
                              {formatTs(note.created_at)}
                              <span style={{ marginLeft: 10, color: T.textMid }}>{note.authorName ?? "User"}</span>
                            </div>
                            {canEditNotes && note.created_by && sessionUserId === note.created_by && (
                              <button
                                type="button"
                                title="Delete your note"
                                onClick={() => openDeleteNoteModal(note)}
                                style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: 4, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                          <div style={{ fontSize: 14, color: T.textDark, lineHeight: 1.5, wordBreak: "break-word" }}>
                            {note.body.length > 400 ? (
                              <>
                                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{note.body.slice(0, 400)}…</p>
                                <details style={{ marginTop: 8 }}>
                                  <summary style={{ cursor: "pointer", fontSize: 12, color: "#233217", fontWeight: 700 }}>Show full note</summary>
                                  <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", color: T.textDark }}>{note.body}</p>
                                </details>
                              </>
                            ) : (
                              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{note.body}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 32px",
            borderTop: `1.5px solid ${T.borderLight}`,
            backgroundColor: "#fff",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", gap: 12 }}>
            {onDelete && canEdit && (
              <button
                type="button"
                disabled={isSaving || !canEdit}
                onClick={onDelete}
                style={{
                  background: "#fff",
                  border: `1.5px solid ${T.border}`,
                  borderRadius: 8,
                  width: 44,
                  height: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#dc2626",
                  cursor: canEdit ? "pointer" : "not-allowed",
                  opacity: canEdit ? 1 : 0.5,
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (canEdit) {
                    e.currentTarget.style.backgroundColor = "#fef2f2";
                    e.currentTarget.style.borderColor = "#dc2626";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#fff";
                  e.currentTarget.style.borderColor = T.border;
                }}
              >
                <Trash2 size={20} />
              </button>
            )}
            <button
              type="button"
              onClick={onCancel}
              style={{
                background: "#fff",
                border: `1.5px solid ${T.border}`,
                borderRadius: 8,
                padding: "0 24px",
                height: 44,
                fontWeight: 700,
                cursor: "pointer",
                color: T.textDark,
                fontSize: 14,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = T.blue;
                e.currentTarget.style.backgroundColor = T.pageBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = T.border;
                e.currentTarget.style.backgroundColor = "#fff";
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="lead-edit-form"
              disabled={isSaving || !canEdit}
              style={{
                background: "#233217",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "0 32px",
                height: 44,
                fontSize: 14,
                fontWeight: 700,
                cursor: canEdit && !isSaving ? "pointer" : "not-allowed",
                opacity: canEdit && !isSaving ? 1 : 0.6,
                boxShadow: "0 4px 12px rgba(35, 50, 23, 0.2)",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (canEdit && !isSaving) {
                  e.currentTarget.style.backgroundColor = "#1a260f";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(35, 50, 23, 0.3)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#233217";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(35, 50, 23, 0.2)";
              }}
            >
              {isSaving ? "Saving…" : "Update"}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Note Confirmation Modal */}
      {showDeleteNoteModal && deletingNote && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#dc2626" }}>Delete Note</h2>
              <button
                onClick={() => setShowDeleteNoteModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textMuted }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 14, color: "#991b1b", lineHeight: 1.6 }}>
                <strong>Warning:</strong> This will permanently delete this note. This action cannot be undone.
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                Type <strong>delete</strong> to confirm deletion
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && deleteConfirmText.toLowerCase() === 'delete') handleDeleteNote();
                  if (e.key === 'Escape') setShowDeleteNoteModal(false);
                }}
                placeholder="delete"
                autoFocus
                style={{
                  width: "100%",
                  height: 44,
                  border: `1.5px solid ${deleteConfirmText.toLowerCase() === 'delete' ? "#dc2626" : T.border}`,
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
                  e.currentTarget.style.borderColor = deleteConfirmText.toLowerCase() === 'delete' ? "#dc2626" : "#233217";
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${deleteConfirmText.toLowerCase() === 'delete' ? "rgba(220, 38, 38, 0.1)" : "rgba(35, 50, 23, 0.1)"}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = deleteConfirmText.toLowerCase() === 'delete' ? "#dc2626" : T.border;
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowDeleteNoteModal(false)}
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
                onClick={handleDeleteNote}
                disabled={deleteConfirmText.toLowerCase() !== 'delete' || deleteInProgress}
                style={{
                  height: 42,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: "none",
                  background: deleteConfirmText.toLowerCase() === 'delete' && !deleteInProgress ? "#dc2626" : T.border,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: deleteConfirmText.toLowerCase() === 'delete' && !deleteInProgress ? "pointer" : "not-allowed",
                  boxShadow: deleteConfirmText.toLowerCase() === 'delete' && !deleteInProgress ? "0 4px 12px rgba(220, 38, 38, 0.2)" : "none",
                  transition: "all 0.15s ease-in-out",
                }}
              >
                {deleteInProgress ? "Deleting..." : "Delete Note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeadEditForm;

// Re-export useLeadEdit hook for convenience
export { useLeadEdit } from "./useLeadEdit";
export type { ToastMessage } from "./useLeadEdit";
