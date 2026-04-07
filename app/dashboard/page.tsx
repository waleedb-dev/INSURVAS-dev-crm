"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCurrentUserPrimaryRole } from "@/lib/auth/user-role";

export default function DashboardRootPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [message, setMessage] = useState("Resolving your CRM workspace...");

  useEffect(() => {
    const redirectToRoleDashboard = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/");
        return;
      }

      const role = await getCurrentUserPrimaryRole(supabase, session.user.id);

      if (!role) {
        await supabase.auth.signOut();
        router.replace("/");
        setMessage("No role is assigned to this account. Contact admin.");
        return;
      }

      router.replace(`/dashboard/${role}`);
    };

    void redirectToRoleDashboard();
  }, [router, supabase]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <p className="text-sm font-semibold text-slate-600">{message}</p>
    </main>
  );
}
