"use client";

import { useParams } from "next/navigation";
import BpoClientRequestPage from "@/components/dashboard/pages/BpoClientRequestPage";

export default function BpoKillListLeadRequestRoutePage() {
  const params = useParams<{ id?: string }>();
  const idParam = Array.isArray(params?.id) ? params.id[0] : params?.id;

  if (!idParam) {
    return <p style={{ margin: 0 }}>Lead not found.</p>;
  }

  return <BpoClientRequestPage leadRowId={idParam} />;
}
