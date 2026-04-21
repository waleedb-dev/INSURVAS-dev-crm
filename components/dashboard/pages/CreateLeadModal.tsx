"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useOptionalDashboardContext } from "@/components/dashboard/DashboardContext";
import { X, Plus, User, Phone, MapPin, Building2, Tag, ListTodo } from "lucide-react";

type CreateLeadModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

type PipelineStage = {
  id: number;
  name: string;
  position: number;
};

type CallCenter = {
  id: string;
  name: string;
};

function buildManualLeadSubmissionId(): string {
  const ts = Date.now();
  const rand = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2))
    .replace(/-/g, "")
    .slice(0, 8);
  return `${ts}-${rand}-SA`;
}

function StyledSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  disabled = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(val) => onValueChange(val || "")} disabled={disabled}>
      <SelectTrigger
        style={{
          width: "100%",
          height: 44,
          borderRadius: 10,
          border: `1px solid ${T.border}`,
          backgroundColor: disabled ? "#f5f5f5" : T.cardBg,
          color: value ? T.textDark : T.textMuted,
          fontSize: 14,
          fontWeight: 500,
          paddingLeft: 14,
          paddingRight: 12,
          transition: "all 0.15s ease-in-out",
          cursor: disabled ? "not-allowed" : "pointer",
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
          backgroundColor: T.cardBg,
          padding: 6,
          maxHeight: 300,
          zIndex: 9999,
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

function InputField({
  label,
  value,
  onChange,
  placeholder,
  icon: Icon,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  type?: string;
  required?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#233217",
          textTransform: "uppercase",
          letterSpacing: "0.3px",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {Icon && <Icon size={14} style={{ color: "#647864" }} />}
        {label}
        {required && <span style={{ color: "#dc2626" }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          height: 44,
          paddingLeft: 14,
          paddingRight: 14,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          fontSize: 14,
          color: T.textDark,
          background: T.cardBg,
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
  );
}

export default function CreateLeadModal({ open, onClose, onSuccess }: CreateLeadModalProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const dashboardContext = useOptionalDashboardContext();
  const shouldCreateDailyDealFlowEntry =
    dashboardContext?.currentRole === "sales_admin" || dashboardContext?.currentRole === "sales_manager";
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [street1, setStreet1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [selectedStageId, setSelectedStageId] = useState("");
  const [selectedCallCenterId, setSelectedCallCenterId] = useState("");
  
  // Options
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [callCenters, setCallCenters] = useState<CallCenter[]>([]);
  const [userCallCenterId, setUserCallCenterId] = useState<string | null>(null);
  
  const leadSourceOptions = [
    { value: "Facebook", label: "Facebook" },
    { value: "Google", label: "Google" },
    { value: "Referral", label: "Referral" },
    { value: "Website", label: "Website" },
    { value: "Cold Call", label: "Cold Call" },
    { value: "Walk-in", label: "Walk-in" },
    { value: "Other", label: "Other" },
  ];

  // Fetch initial data
  useEffect(() => {
    if (!open) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        // Get current user info
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data: profile } = await supabase
            .from("users")
            .select("call_center_id")
            .eq("id", session.user.id)
            .maybeSingle();
          setUserCallCenterId(profile?.call_center_id ?? null);
          if (profile?.call_center_id) {
            setSelectedCallCenterId(profile.call_center_id);
          }
        }
        
        // Fetch pipelines
        const { data: pipelineData } = await supabase
          .from("pipelines")
          .select("id, name")
          .order("name");
        setPipelines(pipelineData || []);
        
        // Fetch call centers
        const { data: centersData } = await supabase
          .from("call_centers")
          .select("id, name")
          .eq("is_active", true)
          .order("name");
        setCallCenters(centersData || []);
        
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load form data");
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [open, supabase]);
  
  // Fetch stages when pipeline changes
  useEffect(() => {
    if (!selectedPipelineId) {
      setStages([]);
      setSelectedStageId("");
      return;
    }
    
    const fetchStages = async () => {
      const { data } = await supabase
        .from("pipeline_stages")
        .select("id, name, position")
        .eq("pipeline_id", selectedPipelineId)
        .order("position", { ascending: true });
      setStages(data || []);
    };
    
    fetchStages();
  }, [selectedPipelineId, supabase]);
  
  const handleSave = useCallback(async () => {
    // Validation
    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required");
      return;
    }
    if (!phone.trim()) {
      setError("Phone number is required");
      return;
    }
    if (!selectedPipelineId) {
      setError("Please select a pipeline");
      return;
    }
    if (!selectedStageId) {
      setError("Please select a stage");
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const submittedBy = session?.user?.id;
      const submissionId = shouldCreateDailyDealFlowEntry ? buildManualLeadSubmissionId() : null;
      const insuredName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const selectedCallCenterName = callCenters.find((center) => center.id === selectedCallCenterId)?.name ?? null;
      
      const { data: insertedLead, error: insertError } = await supabase.from("leads").insert({
        ...(submissionId ? { submission_id: submissionId } : {}),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        street1: street1.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        zip_code: zipCode.trim() || null,
        lead_source: leadSource || null,
        pipeline_id: selectedPipelineId,
        stage_id: selectedStageId,
        call_center_id: selectedCallCenterId || null,
        submitted_by: submittedBy,
        is_draft: false,
      }).select("id").single();
      
      if (insertError) {
        throw new Error(insertError.message);
      }

      if (shouldCreateDailyDealFlowEntry && submissionId && insertedLead?.id) {
        const { error: ddfError } = await supabase.from("daily_deal_flow").insert({
          submission_id: submissionId,
          client_phone_number: phone.trim(),
          lead_vendor: selectedCallCenterName || leadSource || null,
          date: new Date().toISOString().slice(0, 10),
          insured_name: insuredName,
          call_center_id: selectedCallCenterId || null,
        });

        if (ddfError) {
          throw new Error(ddfError.message || "Failed to create daily deal flow entry");
        }
      }
      
      // Reset form
      setFirstName("");
      setLastName("");
      setPhone("");
      setStreet1("");
      setCity("");
      setState("");
      setZipCode("");
      setLeadSource("");
      setSelectedPipelineId("");
      setSelectedStageId("");
      setSelectedCallCenterId(userCallCenterId || "");
      
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lead");
    } finally {
      setSaving(false);
    }
  }, [firstName, lastName, phone, street1, city, state, zipCode, leadSource, selectedPipelineId, selectedStageId, selectedCallCenterId, callCenters, shouldCreateDailyDealFlowEntry, supabase, userCallCenterId, onSuccess, onClose]);
  
  const handleClose = () => {
    if (!saving) {
      onClose();
    }
  };
  
  if (!open) return null;
  
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={handleClose}
    >
      <Card
        style={{
          width: "100%",
          maxWidth: 640,
          maxHeight: "90vh",
          backgroundColor: T.cardBg,
          borderRadius: 16,
          border: `1px solid ${T.border}`,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: `1px solid ${T.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#f8faf8",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: "#233217",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Plus size={20} color="white" />
            </div>
            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#233217",
                  margin: 0,
                }}
              >
                Create New Lead
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "#647864",
                  margin: "2px 0 0 0",
                }}
              >
                Fill in the basic information to create a new lead
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={saving}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: "none",
              backgroundColor: "transparent",
              cursor: saving ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease-in-out",
              opacity: saving ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#EEF5EE";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <X size={20} color="#647864" />
          </button>
        </div>
        
        {/* Content */}
        <div
          style={{
            padding: "24px",
            overflowY: "auto",
            flex: 1,
          }}
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  border: `3px solid ${T.border}`,
                  borderTopColor: "#233217",
                  animation: "spin 0.8s linear infinite",
                  margin: "0 auto 16px",
                }}
              />
              <p style={{ color: T.textMuted, fontSize: 14 }}>Loading...</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Personal Information */}
              <div>
                <h3
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#233217",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    margin: "0 0 16px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <User size={14} />
                  Personal Information
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <InputField
                    label="First Name"
                    value={firstName}
                    onChange={setFirstName}
                    placeholder="Enter first name"
                    required
                  />
                  <InputField
                    label="Last Name"
                    value={lastName}
                    onChange={setLastName}
                    placeholder="Enter last name"
                    required
                  />
                </div>
              </div>
              
              {/* Contact Information */}
              <div>
                <h3
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#233217",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    margin: "24px 0 16px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Phone size={14} />
                  Contact Information
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <InputField
                    label="Phone Number"
                    value={phone}
                    onChange={setPhone}
                    placeholder="(555) 123-4567"
                    type="tel"
                    required
                  />
                  <InputField
                    label="Street Address"
                    value={street1}
                    onChange={setStreet1}
                    placeholder="123 Main St"
                    icon={MapPin}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                    <InputField
                      label="City"
                      value={city}
                      onChange={setCity}
                      placeholder="City"
                    />
                    <InputField
                      label="State"
                      value={state}
                      onChange={setState}
                      placeholder="State"
                    />
                    <InputField
                      label="ZIP Code"
                      value={zipCode}
                      onChange={setZipCode}
                      placeholder="12345"
                    />
                  </div>
                </div>
              </div>
              
              {/* Lead Details */}
              <div>
                <h3
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#233217",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    margin: "24px 0 16px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Tag size={14} />
                  Lead Details
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <label
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#233217",
                          textTransform: "uppercase",
                          letterSpacing: "0.3px",
                          marginBottom: 6,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Building2 size={14} style={{ color: "#647864" }} />
                        Pipeline
                        <span style={{ color: "#dc2626" }}>*</span>
                      </label>
                      <StyledSelect
                        value={selectedPipelineId}
                        onValueChange={(val) => {
                          setSelectedPipelineId(val);
                          setSelectedStageId("");
                        }}
                        options={pipelines.map((p) => ({ value: String(p.id), label: p.name }))}
                        placeholder="Select pipeline..."
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#233217",
                          textTransform: "uppercase",
                          letterSpacing: "0.3px",
                          marginBottom: 6,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <ListTodo size={14} style={{ color: "#647864" }} />
                        Stage
                        <span style={{ color: "#dc2626" }}>*</span>
                      </label>
                      <StyledSelect
                        value={selectedStageId}
                        onValueChange={setSelectedStageId}
                        options={stages.map((s) => ({ value: String(s.id), label: s.name }))}
                        placeholder={selectedPipelineId ? "Select stage..." : "Select pipeline first"}
                        disabled={!selectedPipelineId}
                      />
                    </div>
                  </div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <label
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#233217",
                          textTransform: "uppercase",
                          letterSpacing: "0.3px",
                          marginBottom: 6,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Building2 size={14} style={{ color: "#647864" }} />
                        Call Center
                      </label>
                      <StyledSelect
                        value={selectedCallCenterId}
                        onValueChange={setSelectedCallCenterId}
                        options={callCenters.map((c) => ({ value: c.id, label: c.name }))}
                        placeholder="Select call center..."
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#233217",
                          textTransform: "uppercase",
                          letterSpacing: "0.3px",
                          marginBottom: 6,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Tag size={14} style={{ color: "#647864" }} />
                        Lead Source
                      </label>
                      <StyledSelect
                        value={leadSource}
                        onValueChange={setLeadSource}
                        options={leadSourceOptions}
                        placeholder="Select source..."
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Error Message */}
              {error && (
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: 8,
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#dc2626",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: `1px solid ${T.border}`,
            backgroundColor: "#f8faf8",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 12,
          }}
        >
          <button
            onClick={handleClose}
            disabled={saving}
            style={{
              height: 44,
              padding: "0 24px",
              borderRadius: 10,
              border: `1px solid ${T.border}`,
              backgroundColor: "white",
              color: T.textDark,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: T.font,
              cursor: saving ? "not-allowed" : "pointer",
              transition: "all 0.15s ease-in-out",
              opacity: saving ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#EEF5EE";
              e.currentTarget.style.borderColor = "#233217";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "white";
              e.currentTarget.style.borderColor = T.border;
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            style={{
              height: 44,
              padding: "0 24px",
              borderRadius: 10,
              border: "none",
              backgroundColor: "#233217",
              color: "white",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: T.font,
              cursor: saving || loading ? "not-allowed" : "pointer",
              transition: "all 0.15s ease-in-out",
              opacity: saving || loading ? 0.6 : 1,
              boxShadow: "0 4px 12px rgba(35, 50, 23, 0.25)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            onMouseEnter={(e) => {
              if (!saving && !loading) {
                e.currentTarget.style.backgroundColor = "#1a2616";
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(35, 50, 23, 0.3)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#233217";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(35, 50, 23, 0.25)";
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "scale(0.98)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            {saving ? (
              <>
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "white",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                Creating...
              </>
            ) : (
              <>
                <Plus size={18} />
                Create Lead
              </>
            )}
          </button>
        </div>
      </Card>
    </div>
  );
}
