"use client";

import { useState } from "react";
import DashboardLayout, { type DashPage } from "@/components/dashboard/DashboardLayout";
import MainDashboard from "@/components/dashboard/MainDashboard";
import NearestEventsPage from "@/components/dashboard/NearestEventsPage";
import SupportModal from "@/components/dashboard/SupportModal";
import DailyDealFlowPage from "@/components/dashboard/pages/DailyDealFlowPage";
import AssigningPage from "@/components/dashboard/pages/AssigningPage";
import LeadPipelinePage from "@/components/dashboard/pages/LeadPipelinePage";
import CommissionsPage from "@/components/dashboard/pages/CommissionsPage";
import UsersAccessPage from "@/components/dashboard/pages/UsersAccessPage";
import OperationsGuidePage from "@/components/dashboard/pages/OperationsGuidePage";

export default function DashboardPage() {
  const [activePage, setActivePage] = useState<DashPage>("dashboard");
  const [showSupport, setShowSupport] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleNavigate = (page: DashPage) => {
    setActivePage(page);
    setSearchQuery("");
  };

  const handleSignOut = () => {
    // No-op – auth removed per requirements
    handleNavigate("dashboard");
  };

  return (
    <>
      <DashboardLayout
        activePage={activePage}
        onNavigate={handleNavigate}
        onSignOut={handleSignOut}
        onSupportClick={() => setShowSupport(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      >
        {activePage === "dashboard" && (
          <MainDashboard
            onViewAllEvents={() => setActivePage("nearest-events")}
            searchQuery={searchQuery}
          />
        )}
        {activePage === "nearest-events" && (
          <NearestEventsPage onBack={() => setActivePage("dashboard")} />
        )}
        {activePage === "daily-deal-flow" && <DailyDealFlowPage />}
        {activePage === "assigning"        && <AssigningPage />}
        {activePage === "lead-pipeline"    && <LeadPipelinePage />}
        {activePage === "commissions"      && <CommissionsPage />}
        {activePage === "users-access"     && <UsersAccessPage />}
        {activePage === "operations-guide" && <OperationsGuidePage />}
      </DashboardLayout>

      {showSupport && <SupportModal onClose={() => setShowSupport(false)} />}
    </>
  );
}
