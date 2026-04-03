"use client";

import { useParams, useRouter } from "next/navigation";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";
import TransferLeadWorkspacePage from "@/components/dashboard/pages/TransferLeadWorkspacePage";

export default function TransferLeadDetailRoutePage() {
  const router = useRouter();
  const params = useParams<{ id?: string; role?: string }>();
  const idParam = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const routeRole = Array.isArray(params?.role) ? params.role[0] : params?.role || "agent";
  const { currentRole, permissionKeys } = useDashboardContext();

  const canViewTransferClaimReclaimVisit = permissionKeys.has("action.transfer_leads.claim_reclaim_visit");
  const isCallCenterRole = currentRole === "call_center_admin" || currentRole === "call_center_agent";

  // Block call center roles from accessing verification workspace entirely
  if (isCallCenterRole || !canViewTransferClaimReclaimVisit) {
    return (
      <div style={{
        padding: 24,
        borderRadius: 14,
        border: "1.5px solid #fecaca",
        backgroundColor: "#fef2f2",
        maxWidth: 600,
        margin: "40px auto"
      }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 20, color: "#991b1b", fontWeight: 700 }}>
          Access Denied
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "#7f1d1d", lineHeight: 1.6 }}>
          You do not have permission to access the transfer lead verification workspace.
          This feature is only available to licensed agents and managers.
        </p>
        <button
          onClick={() => router.push(`/dashboard/${routeRole}?page=call-center-lead-intake`)}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            backgroundColor: "#dc2626",
            color: "white",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          Go to Call Center Lead Intake
        </button>
      </div>
    );
  }

  if (!idParam) {
    return <p style={{ margin: 0 }}>Lead not found.</p>;
  }

  return <TransferLeadWorkspacePage leadRowId={idParam} />;
}
