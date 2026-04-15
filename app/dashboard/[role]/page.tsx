"use client";

import { useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { DashPage } from "@/components/dashboard/DashboardLayout";
import MainDashboard from "@/components/dashboard/MainDashboard";
import NearestEventsPage from "@/components/dashboard/NearestEventsPage";
import DailyDealFlowPage from "@/components/dashboard/pages/DailyDealFlowPage";
import LeadPipelinePage from "@/components/dashboard/pages/LeadPipelinePage";
import CallCenterLeadIntakePage from "@/components/dashboard/pages/CallCenterLeadIntakePage";
import UsersAccessPage from "@/components/dashboard/pages/UsersAccessPage";
import PipelineSettingsPage from "@/components/dashboard/pages/PipelineSettingsPage";
import CarrierManagementPage from "@/components/dashboard/pages/CarrierManagementPage";
import BpoCentersPage from "@/components/dashboard/pages/BpoCentersPage";
import CommissionsPage from "@/components/dashboard/pages/CommissionsPage";
import PoliciesPage from "@/components/dashboard/pages/PoliciesPage";
import IMOManagementPage from "@/components/dashboard/pages/IMOManagementPage";
import UplineCarrierStatesManagementPage from "@/components/dashboard/pages/UplineCarrierStatesManagementPage";
import ProductGuidePage from "@/components/dashboard/pages/ProductGuidePage";
import AnnouncementsPage from "@/components/dashboard/pages/AnnouncementsPage";
import TransferCheckTesterPage from "@/components/dashboard/pages/TransferCheckTesterPage";
import PublisherSupportTicketsPage from "@/components/dashboard/pages/PublisherSupportTicketsPage";
import CallCenterSupportTicketsPage from "@/components/dashboard/pages/CallCenterSupportTicketsPage";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";

export default function RoleDashboardPage() {
  const { permissionKeys, visiblePages, searchQuery, currentRole } = useDashboardContext();
  const router = useRouter();
  const params = useParams<{ role?: string }>();
  const routeRole = Array.isArray(params?.role) ? params.role[0] : params?.role;
  const sp = useSearchParams();
  const canViewTransferClaimReclaimVisit =
    permissionKeys.has("action.transfer_leads.claim_reclaim_visit") &&
    currentRole !== "call_center_admin" &&
    currentRole !== "call_center_agent";
  const canEditLeadPipeline = permissionKeys.has("action.lead_pipeline.update") && currentRole !== "call_center_admin";

  const activePage: DashPage = useMemo(() => {
    const qp = sp.get("page") as DashPage | null;
    if (qp && visiblePages.includes(qp)) return qp;
    return visiblePages.includes("dashboard") ? "dashboard" : (visiblePages[0] ?? "dashboard");
  }, [sp, visiblePages]);

  return (
    <>
      {activePage === "dashboard" && (
        <MainDashboard
          onViewAllEvents={() => {
            const role = routeRole || "agent";
            router.push(`/dashboard/${role}?page=nearest-events`);
          }}
          searchQuery={searchQuery}
        />
      )}
      {activePage === "nearest-events" && (
        <NearestEventsPage
          onBack={() => {
            const role = routeRole || "agent";
            router.push(`/dashboard/${role}?page=dashboard`);
          }}
        />
      )}
      {activePage === "daily-deal-flow" && (
        <DailyDealFlowPage
          canProcessActions={permissionKeys.has("action.daily_deal_flow.process")}
          isCallCenterScoped={currentRole === "call_center_admin" || currentRole === "call_center_agent"}
          isSalesManager={currentRole === "sales_manager"}
        />
      )}
      {activePage === "lead-pipeline" && (
        <LeadPipelinePage canUpdateActions={canEditLeadPipeline} />
      )}
      {activePage === "support-tickets" && (
        currentRole === "call_center_admin" ? <CallCenterSupportTicketsPage /> : <PublisherSupportTicketsPage />
      )}
      {activePage === "call-center-lead-intake" && (
        <CallCenterLeadIntakePage
          canCreateLeads={permissionKeys.has("action.transfer_leads.create")}
          canViewTransferClaimReclaimVisit={canViewTransferClaimReclaimVisit}
        />
      )}
      {activePage === "transfer-check-tester" && <TransferCheckTesterPage />}
      {activePage === "users-access" && <UsersAccessPage />}
      {activePage === "pipeline-management" && <PipelineSettingsPage />}
      {activePage === "carrier-management" && <CarrierManagementPage />}
      {activePage === "bpo-centres" && <BpoCentersPage />}
      {activePage === "commissions" && <CommissionsPage />}
      {activePage === "policies" && <PoliciesPage />}
      {activePage === "imo-management" && <IMOManagementPage />}
      {activePage === "upline-carrier-states" && <UplineCarrierStatesManagementPage />}
      {activePage === "product-guide" && <ProductGuidePage />}
      {activePage === "announcements" && <AnnouncementsPage />}
    </>
  );
}
