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
import { useDashboardContext } from "@/components/dashboard/DashboardContext";

export default function RoleDashboardPage() {
  const { permissionKeys, visiblePages, searchQuery } = useDashboardContext();
  const router = useRouter();
  const params = useParams<{ role?: string }>();
  const routeRole = Array.isArray(params?.role) ? params.role[0] : params?.role;
  const sp = useSearchParams();

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
        <DailyDealFlowPage canProcessActions={permissionKeys.has("action.daily_deal_flow.process")} />
      )}
      {activePage === "lead-pipeline" && (
        <LeadPipelinePage canUpdateActions={permissionKeys.has("action.lead_pipeline.update")} />
      )}
      {activePage === "call-center-lead-intake" && (
        <CallCenterLeadIntakePage canCreateLeads={permissionKeys.has("action.transfer_leads.create")} />
      )}
      {activePage === "users-access" && <UsersAccessPage />}
      {activePage === "pipeline-management" && <PipelineSettingsPage />}
      {activePage === "carrier-management" && <CarrierManagementPage />}
      {activePage === "bpo-centres" && <BpoCentersPage />}
    </>
  );
}
