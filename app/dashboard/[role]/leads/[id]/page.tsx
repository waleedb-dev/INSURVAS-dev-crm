"use client";

import { useParams, useRouter } from "next/navigation";
import LeadViewComponent from "@/components/dashboard/pages/LeadViewComponent";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";

export default function LeadDetailsPage() {
  const router = useRouter();
  const params = useParams<{ role?: string; id?: string }>();
  const { permissionKeys, currentRole } = useDashboardContext();

  const idParam = Array.isArray(params?.id) ? params.id[0] : params?.id;

  return (
    <LeadViewComponent
      leadId={idParam}
      canEditLead={permissionKeys.has("action.lead_pipeline.update") && currentRole !== "call_center_admin"}
      onBack={() => router.back()}
    />
  );
}

