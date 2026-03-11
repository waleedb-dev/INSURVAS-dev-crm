"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout, { type DashPage } from "@/components/dashboard/DashboardLayout";
import MainDashboard from "@/components/dashboard/MainDashboard";
import NearestEventsPage from "@/components/dashboard/NearestEventsPage";
import SupportModal from "@/components/dashboard/SupportModal";

import { T } from "@/lib/theme";


const PLACEHOLDER_PAGES: Record<string, { title: string; emoji: string; desc: string }> = {
  projects:     { title: "Projects",     emoji: "📁", desc: "Manage and track all your team projects." },
  calendar:     { title: "Calendar",     emoji: "📅", desc: "View your schedule, deadlines, and events." },
  vacations:    { title: "Vacations",    emoji: "✈️", desc: "Plan and request time off." },
  employees:    { title: "Employees",    emoji: "👥", desc: "Browse and manage your team roster." },
  messenger:    { title: "Messenger",    emoji: "💬", desc: "Chat with your teammates in real time." },
  "info-portal":{ title: "Info Portal", emoji: "📋", desc: "Find company policies, docs, and resources." },
};

export default function RoleDashboardPage() {
  const router = useRouter();
  const [activePage, setActivePage] = useState<DashPage>("dashboard");
  const [showSupport, setShowSupport] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSignOut = () => router.replace("/");
  const handleNavigate = (page: DashPage) => {
    setActivePage(page);
    setSearchQuery(""); // clear search on nav
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
        {Object.keys(PLACEHOLDER_PAGES).includes(activePage) && (
          <PlaceholderPage page={PLACEHOLDER_PAGES[activePage]} onBack={() => setActivePage("dashboard")} />
        )}
      </DashboardLayout>

      {showSupport && <SupportModal onClose={() => setShowSupport(false)} />}
    </>
  );
}

function PlaceholderPage({ page, onBack }: { page: { title: string; emoji: string; desc: string }; onBack: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 16 }}>
      <div style={{ fontSize: 64 }}>{page.emoji}</div>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: T.textDark }}>{page.title}</h1>
      <p style={{ margin: 0, fontSize: 15, color: T.textMuted, fontWeight: 600 }}>{page.desc}</p>
      <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>This section is coming soon.</p>
      <button
        onClick={onBack}
        style={{
          marginTop: 8, backgroundColor: T.blue, color: "#fff", border: "none",
          borderRadius: T.radiusMd, padding: "12px 28px", fontSize: 14, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit", transition: "opacity 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
      >
        ← Back to Dashboard
      </button>
    </div>
  );
}
