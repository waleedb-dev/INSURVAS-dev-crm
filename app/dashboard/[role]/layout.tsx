"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import DashboardLayout, { type DashPage } from "@/components/dashboard/DashboardLayout";
import SupportModal from "@/components/dashboard/SupportModal";
import { DashboardProvider } from "@/components/dashboard/DashboardContext";
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
  "support-tickets",
  "call-center-lead-intake",
  "transfer-check-tester",
  "users-access",
  "nearest-events",
  "pipeline-management",
  "carrier-management",
  "bpo-centres",
  "commissions",
  "policies",
  "carrier-updates",
  "imo-management",
  "upline-carrier-states",
  "imo-settings",
  "product-guide",
  "announcements",
];

function isDashPage(value: string | null): value is DashPage {
  return value !== null && (ALL_PAGES as string[]).includes(value);
}

export default function RoleDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams<{ role?: string }>();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [showSupport, setShowSupport] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<RoleKey | null>(null);
  const [permissionKeys, setPermissionKeys] = useState<Set<PermissionKey>>(new Set());
  const [userDisplayName, setUserDisplayName] = useState("User");
  const [userEmail, setUserEmail] = useState("");
  const [userInitials, setUserInitials] = useState("U");
  const [callCenterBranding, setCallCenterBranding] = useState<{
    name: string;
    logoUrl: string | null;
  } | null>(null);
  const [pageHeaderTitle, setPageHeaderTitle] = useState<ReactNode | null>(null);
  const [pageHeaderActions, setPageHeaderActions] = useState<ReactNode | null>(null);

  const routeRole = Array.isArray(params?.role) ? params.role[0] : params?.role;

  const stableSetPageHeaderTitle = useCallback((n: ReactNode | null) => setPageHeaderTitle(n), []);
  const stableSetPageHeaderActions = useCallback((n: ReactNode | null) => setPageHeaderActions(n), []);

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
        await supabase.auth.signOut();
        router.replace("/");
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
        .select("full_name, call_center_id")
        .eq("id", session.user.id)
        .maybeSingle();

      let centerMeta: { name: string; logoUrl: string | null } | null = null;
      const ccId = profile?.call_center_id;
      if (ccId) {
        const { data: ccRow } = await supabase
          .from("call_centers")
          .select("name, logo_url")
          .eq("id", ccId)
          .maybeSingle();
        if (ccRow) {
          centerMeta = {
            name: String(ccRow.name ?? "").trim(),
            logoUrl: ccRow.logo_url != null && String(ccRow.logo_url).trim() !== "" ? String(ccRow.logo_url).trim() : null,
          };
        }
      }

      const email = session.user.email ?? "";
      const displayName = profile?.full_name?.trim() || email.split("@")[0] || "User";
      const nameParts: string[] = displayName
        .split(" ")
        .map((part: string) => part.trim())
        .filter((part: string) => part.length > 0)
        .slice(0, 2);
      const initials =
        nameParts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "U";

      const keys = await getCurrentUserPermissionKeys(supabase, session.user.id);

      setPermissionKeys(keys);
      setCurrentRole(resolvedRole);
      setUserDisplayName(displayName);
      setUserEmail(email);
      setUserInitials(initials);
      setCallCenterBranding(centerMeta);
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

  const activePage: DashPage = useMemo(() => {
    // Lead detail routes should highlight Lead Pipeline.
    if (pathname?.includes("/leads/")) return "lead-pipeline";
    if (pathname?.includes("/transfer-leads/")) return "call-center-lead-intake";
    if (pathname?.includes("/retention-flow")) return "call-center-lead-intake";

    const qp = searchParams.get("page");
    if (isDashPage(qp) && visiblePages.includes(qp)) return qp;

    return visiblePages.includes("dashboard") ? "dashboard" : visiblePages[0] || "dashboard";
  }, [pathname, searchParams, visiblePages]);

  const handleNavigate = (page: DashPage) => {
    if (!visiblePages.includes(page)) return;
    const role = routeRole || "agent";
    router.push(`/dashboard/${role}?page=${page}`);
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

  if (errorMessage || !currentRole) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <p className="text-sm font-semibold text-rose-700">{errorMessage || "Could not load dashboard."}</p>
      </main>
    );
  }

  return (
    <DashboardProvider
      value={{
        currentRole,
        permissionKeys,
        visiblePages,
        userDisplayName,
        userEmail,
        userInitials,
        searchQuery,
        setSearchQuery,
        pageHeaderTitle,
        pageHeaderActions,
        setPageHeaderTitle: stableSetPageHeaderTitle,
        setPageHeaderActions: stableSetPageHeaderActions,
      }}
    >
      <DashboardLayout
        activePage={activePage}
        onNavigate={handleNavigate}
        onSignOut={handleSignOut}
        onSupportClick={() => setShowSupport(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        visiblePages={visiblePages.filter((page) => page !== "nearest-events")}
        userDisplayName={userDisplayName}
        userEmail={userEmail}
        userInitials={userInitials}
        callCenter={callCenterBranding}
      >
        {children}
      </DashboardLayout>

      {showSupport && <SupportModal onClose={() => setShowSupport(false)} />}
    </DashboardProvider>
  );
}

