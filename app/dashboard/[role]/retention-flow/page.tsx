"use client";

import { useParams, useSearchParams } from "next/navigation";
import TransferLeadRetentionFlowPage from "@/components/dashboard/pages/TransferLeadRetentionFlowPage";

export default function RetentionFlowRoutePage() {
  const params = useParams<{ role?: string }>();
  const searchParams = useSearchParams();
  const role = Array.isArray(params?.role) ? params.role[0] : params?.role || "agent";
  const leadRowId = searchParams.get("leadRowId");

  if (!leadRowId) {
    return <p style={{ margin: 0 }}>Missing lead context for retention flow.</p>;
  }

  return <TransferLeadRetentionFlowPage leadRowId={leadRowId} role={role} />;
}
