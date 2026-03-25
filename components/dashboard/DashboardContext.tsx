"use client";

import { createContext, useContext } from "react";
import type { DashPage } from "@/components/dashboard/DashboardLayout";
import type { RoleKey } from "@/lib/auth/roles";
import type { PermissionKey } from "@/lib/auth/permissions";

export type DashboardContextValue = {
  currentRole: RoleKey;
  permissionKeys: Set<PermissionKey>;
  visiblePages: DashPage[];
  userDisplayName: string;
  userEmail: string;
  userInitials: string;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
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

