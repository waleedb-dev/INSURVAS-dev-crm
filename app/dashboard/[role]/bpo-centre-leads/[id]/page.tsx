"use client";

import { useParams, useRouter } from "next/navigation";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";
import BpoCentreLeadViewComponent from "@/components/dashboard/pages/BpoCentreLeadViewComponent";

export default function BpoCentreLeadDetailsPage() {
  const router = useRouter();
  const params = useParams<{ role?: string; id?: string }>();
  const { currentRole } = useDashboardContext();

  const idParam = Array.isArray(params?.id) ? params.id[0] : params?.id;

  return (
    <BpoCentreLeadViewComponent
      centerLeadId={idParam}
      canEdit={currentRole === "system_admin"}
      onBack={() => router.back()}
    />
  );
}

