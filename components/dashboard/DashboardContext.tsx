"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DashPage } from "@/components/dashboard/DashboardLayout";
import type { RoleKey } from "@/lib/auth/roles";
import type { PermissionKey } from "@/lib/auth/permissions";

export type DashboardContextValue = {
  currentRole: RoleKey;
  currentUserId: string | null;
  permissionKeys: Set<PermissionKey>;
  visiblePages: DashPage[];
  userDisplayName: string;
  userEmail: string;
  userInitials: string;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  /** Optional override for the sticky top bar title; when null, layout uses the default label for `activePage`. */
  pageHeaderTitle: ReactNode | null;
  /** Primary actions rendered in the top bar (e.g. “Add New Lead”). Clear on unmount. */
  pageHeaderActions: ReactNode | null;
  setPageHeaderTitle: (node: ReactNode | null) => void;
  setPageHeaderActions: (node: ReactNode | null) => void;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({
  value,
  children,
}: {
  value: DashboardContextValue;
  children: React.ReactNode;
}) {
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboardContext() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboardContext must be used within DashboardProvider");
  return ctx;
}

/** Same as `useDashboardContext` but returns null outside `DashboardProvider` (for leaf components used in multiple shells). */
export function useOptionalDashboardContext(): DashboardContextValue | null {
  return useContext(DashboardContext);
}

