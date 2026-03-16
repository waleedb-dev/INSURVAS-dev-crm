"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout, { type DashPage } from "@/components/dashboard/DashboardLayout";
import MainDashboard from "@/components/dashboard/MainDashboard";
import NearestEventsPage from "@/components/dashboard/NearestEventsPage";
import SupportModal from "@/components/dashboard/SupportModal";
import DailyDealFlowPage from "@/components/dashboard/pages/DailyDealFlowPage";
import LeadPipelinePage from "@/components/dashboard/pages/LeadPipelinePage";
import UsersAccessPage from "@/components/dashboard/pages/UsersAccessPage";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCurrentUserPrimaryRole } from "@/lib/auth/user-role";
import type { RoleKey } from "@/lib/auth/roles";
import {
  canAccessPage,
  getCurrentUserPermissionKeys,
  type PermissionKey,
} from "@/lib/auth/permissions";

const ALL_PAGES: DashPage[] = [
  "dashboard",
  "daily-deal-flow",
  "lead-pipeline",
  "users-access",
  "nearest-events",
];

export default function RoleDashboardPage() {
  const router = useRouter();
  const params = useParams<{ role?: string }>();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [activePage, setActivePage] = useState<DashPage>("dashboard");
  const [showSupport, setShowSupport] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<RoleKey | null>(null);
  const [permissionKeys, setPermissionKeys] = useState<Set<PermissionKey>>(new Set());
  const [userDisplayName, setUserDisplayName] = useState("User");
  const [userEmail, setUserEmail] = useState("");
  const [userInitials, setUserInitials] = useState("U");

  const routeRole = Array.isArray(params?.role) ? params.role[0] : params?.role;

  useEffect(() => {
    const bootstrapDashboard = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/");
        return;
      }

      const resolvedRole = await getCurrentUserPrimaryRole(supabase, session.user.id);

      if (!resolvedRole) {
        setErrorMessage("No role is assigned to this account. Contact admin.");
        setIsLoading(false);
        return;
      }

      if (!routeRole || routeRole !== resolvedRole) {
        router.replace(`/dashboard/${resolvedRole}`);
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("full_name")
        .eq("id", session.user.id)
        .maybeSingle();

      const email = session.user.email ?? "";
      const displayName = profile?.full_name?.trim() || email.split("@")[0] || "User";
      const nameParts: string[] = displayName
        .split(" ")
        .map((part: string) => part.trim())
        .filter((part: string) => part.length > 0)
        .slice(0, 2);
      const initials = nameParts
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || "U";

      const keys = await getCurrentUserPermissionKeys(supabase, session.user.id);
      setPermissionKeys(keys);
      setCurrentRole(resolvedRole);
      setUserDisplayName(displayName);
      setUserEmail(email);
      setUserInitials(initials);
      setIsLoading(false);
    };

    void bootstrapDashboard();
  }, [routeRole, router, supabase]);

  const visiblePages = useMemo(
    () =>
      ALL_PAGES.filter((page) =>
        page === "nearest-events" ? true : canAccessPage(page, currentRole, permissionKeys),
      ),
    [currentRole, permissionKeys],
  );
  const resolvedActivePage: DashPage = visiblePages.includes(activePage) ? activePage : "dashboard";

  const handleNavigate = (page: DashPage) => {
    if (!visiblePages.includes(page)) {
      return;
    }

    setActivePage(page);
    setSearchQuery("");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <p className="text-sm font-semibold text-slate-600">Loading CRM workspace...</p>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <p className="text-sm font-semibold text-rose-700">{errorMessage}</p>
      </main>
    );
  }

  return (
    <>
      <DashboardLayout
        activePage={resolvedActivePage}
        onNavigate={handleNavigate}
        onSignOut={handleSignOut}
        onSupportClick={() => setShowSupport(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        visiblePages={visiblePages.filter((page) => page !== "nearest-events")}
        userDisplayName={userDisplayName}
        userEmail={userEmail}
        userInitials={userInitials}
      >
        {resolvedActivePage === "dashboard" && (
          <MainDashboard
            onViewAllEvents={() =>
              visiblePages.includes("nearest-events") ? setActivePage("nearest-events") : undefined
            }
            searchQuery={searchQuery}
          />
        )}
        {resolvedActivePage === "nearest-events" && (
          <NearestEventsPage onBack={() => setActivePage("dashboard")} />
        )}
        {resolvedActivePage === "daily-deal-flow" && (
          <DailyDealFlowPage canProcessActions={permissionKeys.has("action.daily_deal_flow.process")} />
        )}
        {resolvedActivePage === "lead-pipeline" && (
          <LeadPipelinePage canUpdateActions={permissionKeys.has("action.lead_pipeline.update")} />
        )}
        {resolvedActivePage === "users-access" && <UsersAccessPage />}
      </DashboardLayout>

      {showSupport && <SupportModal onClose={() => setShowSupport(false)} />}
    </>
  );
}
