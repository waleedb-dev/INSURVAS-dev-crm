"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";
import BpoCentreLeadViewComponent from "@/components/dashboard/pages/BpoCentreLeadViewComponent";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function BpoCentreLeadDetailsPage() {
  const router = useRouter();
  const params = useParams<{ role?: string; id?: string }>();
  const { currentRole } = useDashboardContext();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const idParam = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const routeRole = Array.isArray(params?.role) ? params.role[0] : params?.role;

  const [allLeadIds, setAllLeadIds] = useState<string[]>([]);

  const loadIds = useCallback(async () => {
    const { data } = await supabase
      .from("bpo_center_leads")
      .select("id")
      .order("created_at", { ascending: false });
    if (data) setAllLeadIds(data.map((r) => r.id));
  }, [supabase]);

  useEffect(() => {
    void loadIds();
  }, [loadIds]);

  return (
    <BpoCentreLeadViewComponent
      centerLeadId={idParam}
      canEdit={currentRole === "system_admin"}
      onBack={() => {
        const role = routeRole || "agent";
        router.push(`/dashboard/${role}`);
      }}
      allLeadIds={allLeadIds}
    />
  );
}
