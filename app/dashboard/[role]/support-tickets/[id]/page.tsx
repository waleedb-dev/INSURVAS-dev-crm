"use client";

import { useParams, useRouter } from "next/navigation";
import TicketDetailPage from "@/components/dashboard/pages/TicketDetailPage";

export default function SupportTicketDetailRoutePage() {
  const router = useRouter();
  const params = useParams<{ id?: string; role?: string }>();
  const idParam = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const routeRole = Array.isArray(params?.role) ? params.role[0] : params?.role || "agent";

  if (!idParam) {
    return <p style={{ margin: 0 }}>Ticket not found.</p>;
  }

  return (
    <TicketDetailPage
      ticketId={idParam}
      onBack={() => router.push(`/dashboard/${routeRole}?page=support-tickets`)}
      routeRole={routeRole}
    />
  );
}
