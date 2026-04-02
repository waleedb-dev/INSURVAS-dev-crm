"use client";

/**
 * EXAMPLE: How to integrate LeadEditForm into LeadViewComponent
 *
 * This shows the key changes needed to replace the inline editing
 * with the new reusable LeadEditForm modal.
 */

import { useState } from "react";
import { LeadEditForm, useLeadEdit, Toast } from "@/components/ui";
import type { LeadEditFormData } from "@/components/ui";

// Example usage inside LeadViewComponent
export function LeadEditIntegrationExample({
  rowUuid,
  leadRow,
  canEditLead,
  onLeadUpdated,
  onLeadDeleted,
}: {
  rowUuid: string | null;
  leadRow: Record<string, unknown> | null;
  canEditLead: boolean;
  onLeadUpdated?: (lead: Record<string, unknown>) => void;
  onLeadDeleted?: () => void;
}) {
  // State to control modal visibility
  const [isEditing, setIsEditing] = useState(false);

  // Use the hook to handle data fetching and saving
  const {
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
  } = useLeadEdit({
    leadRowUuid: rowUuid,
    canEdit: canEditLead,
    onSave: (updatedLead) => {
      onLeadUpdated?.(updatedLead);
      setIsEditing(false);
    },
    onDelete: () => {
      onLeadDeleted?.();
      setIsEditing(false);
    },
  });

  // Handle form submission
  const handleSubmit = async (data: LeadEditFormData) => {
    await saveLead(data);
  };

  // Generate title from lead name
  const title = leadRow
    ? `Edit "${leadRow.first_name || ""} ${leadRow.last_name || ""}"`.trim()
    : "Edit Lead";

  // Default empty lead data for initial render
  const defaultLeadData: LeadEditFormData = {
    firstName: "",
    lastName: "",
    phone: "",
    pipelineId: null,
    stageId: null,
    leadValue: null,
    licensedAgentAccount: "",
    leadSource: "",
    tags: "",
    carrier: "",
    productType: "",
    monthlyPremium: "",
  };

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={clearToast}
        />
      )}

      {/* Edit Lead Button - place this in your header/actions area */}
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        disabled={!canEditLead || !leadRow}
        style={{
          border: "1px solid #c8d4bb",
          borderRadius: 12,
          background: "#fff",
          color: "#233217",
          fontSize: 13,
          fontWeight: 700,
          padding: "10px 20px",
          cursor: canEditLead && leadRow ? "pointer" : "not-allowed",
          opacity: canEditLead && leadRow ? 1 : 0.55,
        }}
      >
        Edit Lead
      </button>

      {/* Lead Edit Modal - only render when editing */}
      {isEditing && (
        <LeadEditForm
          lead={defaultLeadData}
          leadRowUuid={rowUuid}
          pipelines={pipelines}
          stages={stages}
          licensedAgents={licensedAgents}
          canEdit={canEditLead}
          onSubmit={handleSubmit}
          onCancel={() => setIsEditing(false)}
          onDelete={canEditLead ? deleteLead : undefined}
          isSaving={isSaving}
          isLoading={isLoading}
          error={error}
          title={title}
        />
      )}
    </>
  );
}

/**
 * INTEGRATION STEPS:
 *
 * 1. In LeadViewComponent.tsx, replace the existing edit state:
 *
 *    REMOVE:
 *    - const [isEditing, setIsEditing] = useState(false);
 *    - const [editDraft, setEditDraft] = useState<LeadRow | null>(null);
 *    - const [saving, setSaving] = useState(false);
 *    - const [saveError, setSaveError] = useState<string | null>(null);
 *    - const startEdit, cancelEdit, saveLeadEdits, patchDraft functions
 *    - The inline edit form JSX from the Overview tab
 *
 * 2. ADD the imports:
 *
 *    import { LeadEditForm, useLeadEdit, Toast } from "@/components/ui";
 *    import type { LeadEditFormData } from "@/components/ui";
 *
 * 3. ADD the useLeadEdit hook inside the component:
 *
 *    const {
 *      lead,
 *      pipelines,
 *      stages,
 *      licensedAgents,
 *      isLoading,
 *      isSaving,
 *      error,
 *      toast,
 *      saveLead,
 *      deleteLead,
 *      clearToast,
 *    } = useLeadEdit({
 *      leadRowUuid: rowUuid,
 *      canEdit: effectiveCanEditLead,
 *      onSave: (updated) => {
 *        setLeadRow(updated as LeadRow);
 *        setIsEditing(false);
 *      },
 *    });
 *
 * 4. REPLACE the "Edit Lead" button handler:
 *
 *    Change from: onClick={startEdit}
 *    To: onClick={() => setIsEditing(true)}
 *
 * 5. REPLACE the save/cancel buttons in the header:
 *
 *    REMOVE the isEditing conditional block that shows Cancel/Save changes
 *    buttons. Keep only the "Edit Lead" button.
 *
 * 6. ADD the Toast and LeadEditForm at the end of the component (before closing div):
 *    See actual component code above for implementation.
 *
 * KEY BENEFITS OF THIS APPROACH:
 *
 * - Form validation with Zod (required fields, format validation)
 * - Consistent UI across the app (same form in Pipeline and Lead View)
 * - Type-safe form handling with React Hook Form
 * - Toast notifications for success/error states
 * - Reusable component that can be used anywhere
 * - Clean separation of concerns (form UI vs data logic)
 * - Disabled state handling for read-only users
 * - Focus states and hover effects for better UX
 */

export default LeadEditIntegrationExample;
