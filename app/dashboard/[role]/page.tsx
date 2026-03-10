"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCurrentUserPrimaryRole } from "@/lib/auth/user-role";
import {
  ROLE_SUMMARIES,
  ROLE_TITLES,
  isRoleKey,
  type RoleKey,
} from "@/lib/auth/roles";

type DashboardCard = {
  label: string;
  value: string;
};

const DASHBOARD_CARDS: Record<RoleKey, DashboardCard[]> = {
  system_admin: [
    { label: "Active Users", value: "128" },
    { label: "Open Tickets", value: "17" },
    { label: "System Alerts", value: "3" },
  ],
  sales_manager: [
    { label: "Team Leads", value: "89" },
    { label: "Leads Reassigned", value: "12" },
    { label: "Conversion Rate", value: "34%" },
  ],
  sales_agent_licensed: [
    { label: "Assigned Leads", value: "24" },
    { label: "Follow-ups Today", value: "6" },
    { label: "Conversions", value: "4" },
  ],
  sales_agent_unlicensed: [
    { label: "Verification Queue", value: "19" },
    { label: "Pending Callbacks", value: "7" },
    { label: "Disposed Today", value: "11" },
  ],
  call_center_admin: [
    { label: "Center Submissions", value: "142" },
    { label: "Agent Utilization", value: "81%" },
    { label: "Escalations", value: "5" },
  ],
  call_center_agent: [
    { label: "My Transfers", value: "31" },
    { label: "Pending Verifications", value: "4" },
    { label: "Follow-ups", value: "9" },
  ],
  hr: [
    { label: "Open Onboarding", value: "8" },
    { label: "Role Changes", value: "3" },
    { label: "Pending Activations", value: "2" },
  ],
  accounting: [
    { label: "Pending Commissions", value: "$12,800" },
    { label: "Chargebacks", value: "6" },
    { label: "Daily Deal Flow", value: "43" },
  ],
};

export default function RoleDashboardPage() {
  const params = useParams<{ role: string }>();
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [currentRole, setCurrentRole] = useState<RoleKey | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRole = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/");
        return;
      }

      const userRole = await getCurrentUserPrimaryRole(supabase, session.user.id);

      if (!userRole) {
        router.replace("/");
        return;
      }

      if (!isRoleKey(params.role) || params.role !== userRole) {
        router.replace(`/dashboard/${userRole}`);
        return;
      }

      setCurrentRole(userRole);
      setLoading(false);
    };

    void loadRole();
  }, [params.role, router, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (loading || !currentRole) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <p className="text-sm font-semibold text-slate-600">Loading dashboard...</p>
      </main>
    );
  }

  const cards = DASHBOARD_CARDS[currentRole];

  return (
    <main
      className="min-h-screen px-6 py-8"
      style={{
        background:
          "linear-gradient(155deg, #eef2f7 0%, #dbeafe 50%, #f8fafc 100%)",
      }}
    >
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 flex items-center justify-between rounded-2xl bg-white p-6 shadow-sm">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-500">
              Role Based View
            </p>
            <h1 className="text-2xl font-extrabold text-slate-900">
              {ROLE_TITLES[currentRole]}
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {ROLE_SUMMARIES[currentRole]}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Sign out
          </button>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.label}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {card.label}
              </p>
              <p className="mt-3 text-2xl font-extrabold text-slate-900">{card.value}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
