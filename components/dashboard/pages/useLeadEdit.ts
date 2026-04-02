"use client";

import { useState, useCallback, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import * as z from "zod";

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
  dateOfBirth: z.string().optional(), // date in DB
  social: z.string().max(20, "SSN must be at most 20 characters").optional(),
  driverLicenseNumber: z.string().max(50, "Driver's license must be at most 50 characters").optional(),
  birthState: z.string().max(50, "Birth state must be at most 50 characters").optional(),
  age: z.string().max(10, "Age must be at most 10 characters").optional(),
  
  // Health & Underwriting - all text in DB
  height: z.string().max(20, "Height must be at most 20 characters").optional(),
  weight: z.string().max(20, "Weight must be at most 20 characters").optional(),
  tobaccoUse: z.string().optional(), // 'Yes' or 'No' in DB
  healthConditions: z.string().max(500, "Health conditions must be at most 500 characters").optional(),
  medications: z.string().max(500, "Medications must be at most 500 characters").optional(),
  doctorName: z.string().max(100, "Doctor name must be at most 100 characters").optional(),
  existingCoverage: z.string().optional(), // 'Yes' or 'No' in DB
  previousApplications: z.string().optional(), // 'Yes' or 'No' in DB
  
  // Pipeline & Stage (stored as IDs in DB)
  pipelineId: z.number().nullable().or(z.literal("")),
  stageId: z.number().nullable().or(z.literal("")),
  // Display names (not stored in DB)
  pipelineName: z.string().optional(),
  stageName: z.string().optional(),
  
  // Opportunity Details
  leadValue: z.number().min(0, "Value must be positive").nullable().or(z.literal("")),
  licensedAgentAccount: z.string().optional(),
  leadSource: z.string().max(100, "Lead source must be at most 100 characters").optional(),
  tags: z.string().optional(), // text[] in DB
  submissionDate: z.string().optional(), // date in DB
  
  // Policy & Coverage - text in DB
  carrier: z.string().max(100, "Carrier must be at most 100 characters").optional(),
  productType: z.string().max(100, "Product type must be at most 100 characters").optional(),
  coverageAmount: z.string().max(100, "Coverage amount must be at most 100 characters").optional(),
  monthlyPremium: z.string().max(100, "Monthly premium must be at most 100 characters").optional(),
  draftDate: z.string().optional(), // date in DB
  futureDraftDate: z.string().optional(), // date in DB
  beneficiaryInformation: z.string().max(500, "Beneficiary info must be at most 500 characters").optional(),
  additionalInformation: z.string().max(1000, "Additional info must be at most 1000 characters").optional(),
  
  // Banking Details
  bankAccountType: z.string().max(50, "Account type must be at most 50 characters").optional(),
  institutionName: z.string().max(100, "Institution name must be at most 100 characters").optional(),
  routingNumber: z.string().max(20, "Routing number must be at most 20 characters").optional(),
  accountNumber: z.string().max(50, "Account number must be at most 50 characters").optional(),
  
  // System fields (read-only typically)
  language: z.string().max(50, "Language must be at most 50 characters").optional(),
  isDraft: z.boolean().optional(),
  submissionId: z.string().optional(),
});

export type LeadEditFormData = z.infer<typeof formSchema>;

type LeadRow = Record<string, unknown>;

interface UseLeadEditOptions {
  leadRowUuid: string | null;
  canEdit: boolean;
  onSave?: (updatedLead: LeadRow) => void;
  onDelete?: () => void;
}

export type ToastMessage = {
  message: string;
  type: "success" | "error" | "info" | "warning";
};

interface UseLeadEditReturn {
  pipelines: { id: number; name: string }[];
  stages: { id: number; name: string }[];
  licensedAgents: { value: string; label: string }[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  toast: ToastMessage | null;
  saveLead: (data: LeadEditFormData) => Promise<void>;
  deleteLead: () => Promise<void>;
  clearToast: () => void;
}

export function useLeadEdit({
  leadRowUuid,
  canEdit,
  onSave,
  onDelete,
}: UseLeadEditOptions): UseLeadEditReturn {
  const supabase = getSupabaseBrowserClient();
  const [pipelines, setPipelines] = useState<{ id: number; name: string }[]>([]);
  const [stages, setStages] = useState<{ id: number; name: string }[]>([]);
  const [licensedAgents, setLicensedAgents] = useState<{ value: string; label: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const clearToast = useCallback(() => setToast(null), []);

  // Fetch lookup data (pipelines, stages, agents)
  useEffect(() => {
    async function fetchLookups() {
      setIsLoading(true);
      try {
        // Fetch pipelines with IDs
        const { data: pipelinesData } = await supabase.from("pipelines").select("id, name").order("name");
        setPipelines(pipelinesData?.map((p) => ({ id: Number(p.id), name: p.name })) || []);

        // Fetch stages with IDs
        const { data: stagesData } = await supabase.from("pipeline_stages").select("id, name").order("position");
        setStages(stagesData?.map((s) => ({ id: Number(s.id), name: s.name })) || []);

        // Fetch licensed agents
        const { data: agentsData } = await supabase
          .from("users")
          .select("id, full_name")
          .eq("role", "sales_agent_licensed")
          .order("full_name");
        setLicensedAgents(
          agentsData?.map((a) => ({
            value: a.full_name || "",
            label: a.full_name || "Unnamed",
          })) || []
        );
      } catch {
        // Silently fail - lookups are not critical
      } finally {
        setIsLoading(false);
      }
    }
    fetchLookups();
  }, [supabase]);

  const saveLead = useCallback(
    async (data: LeadEditFormData) => {
      if (!leadRowUuid || !canEdit) {
        setToast({ message: "You do not have permission to edit this lead", type: "error" });
        return;
      }

      setIsSaving(true);
      setError(null);

      try {
        const payload: Record<string, unknown> = {
          // Contact
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone,
          language: data.language || null,
          
          // Address
          street1: data.street1 || null,
          street2: data.street2 || null,
          city: data.city || null,
          state: data.state || null,
          zip_code: data.zipCode || null,
          
          // Personal
          date_of_birth: data.dateOfBirth || null,
          social: data.social || null,
          driver_license_number: data.driverLicenseNumber || null,
          birth_state: data.birthState || null,
          age: data.age || null,
          
          // Health
          height: data.height || null,
          weight: data.weight || null,
          tobacco_use: data.tobaccoUse || null,
          health_conditions: data.healthConditions || null,
          medications: data.medications || null,
          doctor_name: data.doctorName || null,
          existing_coverage_last_2_years: data.existingCoverage || null,
          previous_applications_2_years: data.previousApplications || null,
          
          // Pipeline & Stage (use IDs)
          pipeline_id: data.pipelineId,
          stage_id: data.stageId,
          
          // Opportunity
          lead_value: data.leadValue,
          licensed_agent_account: data.licensedAgentAccount || null,
          lead_source: data.leadSource || null,
          tags: data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : null,
          submission_date: data.submissionDate || null,
          
          // Policy
          carrier: data.carrier || null,
          product_type: data.productType || null,
          coverage_amount: data.coverageAmount || null,
          monthly_premium: data.monthlyPremium || null,
          draft_date: data.draftDate || null,
          future_draft_date: data.futureDraftDate || null,
          beneficiary_information: data.beneficiaryInformation || null,
          additional_information: data.additionalInformation || null,
          
          // Banking
          bank_account_type: data.bankAccountType || null,
          institution_name: data.institutionName || null,
          routing_number: data.routingNumber || null,
          account_number: data.accountNumber || null,
        };

        const { data: updated, error: updateError } = await supabase
          .from("leads")
          .update(payload)
          .eq("id", leadRowUuid)
          .select("*")
          .maybeSingle();

        if (updateError) throw updateError;

        setToast({ message: "Lead updated successfully", type: "success" });
        onSave?.(updated as LeadRow);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save lead";
        setError(message);
        setToast({ message, type: "error" });
      } finally {
        setIsSaving(false);
      }
    },
    [leadRowUuid, canEdit, supabase, onSave]
  );

  const deleteLead = useCallback(async () => {
    if (!leadRowUuid || !canEdit) {
      setToast({ message: "You do not have permission to delete this lead", type: "error" });
      return;
    }

    if (!window.confirm("Are you sure you want to delete this lead? This action cannot be undone.")) {
      return;
    }

    try {
      const { error: deleteError } = await supabase.from("leads").delete().eq("id", leadRowUuid);

      if (deleteError) throw deleteError;

      setToast({ message: "Lead deleted successfully", type: "success" });
      onDelete?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete lead";
      setToast({ message: message, type: "error" });
    }
  }, [leadRowUuid, canEdit, supabase, onDelete]);

  return {
    pipelines,
    stages,
    licensedAgents,
    isLoading,
    isSaving,
    error,
    toast,
    saveLead,
    deleteLead,
    clearToast,
  };
}

export default useLeadEdit;
